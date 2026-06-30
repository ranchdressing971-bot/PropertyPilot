import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { getOpenAI } from "./openai";
import type { AddressCandidateContext } from "./geo/nearby-addresses";
import { matchAddressToRoster } from "./address-detect";
import type { Property } from "./mock-data";
import type { ExtractedFrame } from "./video-frames";
import { ADDRESS_REVIEW_THRESHOLD } from "./geo/types";

const FRAMES_PER_MATCH_CALL = 4;

export interface AddressMatchResult {
  frameIndex: number;
  /** Raw text read from mailbox / curb / door */
  visibleText: string | null;
  houseNumber: string | null;
  matchedAddress: string;
  matchedPropertyId: string | null;
  confidence: number;
  needsReview: boolean;
  reasoning: string;
  focalRegion: "mailbox" | "curb" | "door" | "sign" | "facade" | "none";
}

function buildMatchPrompt(
  ctx: AddressCandidateContext,
  startIndex: number,
  batchSize: number
): string {
  const candidateBlock =
    ctx.candidates.length > 0
      ? ctx.candidates.map((a, i) => `${i + 1}. ${a}`).join("\n")
      : "(no roster — read whatever is visible)";

  return `You are matching HOA drive-through video frames to street addresses.

Pipeline for EACH frame:
1. Mentally crop to mailbox, house number, curb, door, or street sign
2. Read visible numbers and text (visibleText, houseNumber)
3. Pick the BEST matching address from the candidate list OR state a new full address if clearly different
4. Assign confidence 0-100 (use <${ADDRESS_REVIEW_THRESHOLD} when unsure or ambiguous between two homes)
5. Set needsReview true when confidence < ${ADDRESS_REVIEW_THRESHOLD} or two candidates could match

Context: ${ctx.promptContext}

Candidate addresses (prefer these when the visible number matches):
${candidateBlock}

Respond JSON only:
{
  "matches": [
    {
      "frameIndex": ${startIndex},
      "visibleText": "123" or "mailbox 123 Oak" or null,
      "houseNumber": "123" or null,
      "matchedAddress": "123 Oak Lane",
      "confidence": 85,
      "needsReview": false,
      "focalRegion": "mailbox",
      "reasoning": "clear mailbox digits 123 matches candidate 1"
    }
  ]
}

One entry per frame (${batchSize} frames in this batch, indices ${startIndex}–${startIndex + batchSize - 1}).`;
}

async function matchBatch(
  frames: ExtractedFrame[],
  startIndex: number,
  ctx: AddressCandidateContext,
  roster: Property[]
): Promise<AddressMatchResult[]> {
  const content: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: buildMatchPrompt(ctx, startIndex, frames.length),
    },
    ...frames.flatMap((frame, i) => [
      {
        type: "text" as const,
        text: `Frame ${startIndex + i} (${frame.timestamp.toFixed(1)}s):`,
      },
      {
        type: "image_url" as const,
        image_url: { url: frame.dataUrl, detail: "high" as const },
      },
    ]),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as {
    matches?: {
      frameIndex: number;
      visibleText: string | null;
      houseNumber: string | null;
      matchedAddress: string;
      confidence: number;
      needsReview?: boolean;
      focalRegion?: AddressMatchResult["focalRegion"];
      reasoning: string;
    }[];
  };

  return (parsed.matches ?? []).map((m) => {
    const frameIndex =
      m.frameIndex >= startIndex ? m.frameIndex : startIndex + m.frameIndex;

    const rosterMatch =
      roster.length > 0
        ? matchAddressToRoster(m.matchedAddress, roster)
        : null;

    const confidence = Math.min(99, Math.max(0, m.confidence ?? 0));
    const needsReview =
      m.needsReview ?? confidence < ADDRESS_REVIEW_THRESHOLD;

    return {
      frameIndex,
      visibleText: m.visibleText,
      houseNumber: m.houseNumber,
      matchedAddress: m.matchedAddress?.trim() || m.visibleText || "Unknown",
      matchedPropertyId: rosterMatch?.id ?? null,
      confidence,
      needsReview,
      reasoning: m.reasoning ?? "",
      focalRegion: m.focalRegion ?? "none",
    };
  });
}

/**
 * GPS + roster assisted address matching (crop mailbox → pick best candidate).
 */
export async function runAddressMatchPipeline(
  frames: ExtractedFrame[],
  ctx: AddressCandidateContext,
  roster: Property[] = []
): Promise<AddressMatchResult[]> {
  const all: AddressMatchResult[] = [];

  for (let i = 0; i < frames.length; i += FRAMES_PER_MATCH_CALL) {
    const batch = frames.slice(i, i + FRAMES_PER_MATCH_CALL);
    const matches = await matchBatch(batch, i, ctx, roster);
    all.push(...matches);
  }

  return all;
}
