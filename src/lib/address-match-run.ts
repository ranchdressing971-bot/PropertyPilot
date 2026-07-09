import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { AddressCandidateContext } from "./geo/nearby-addresses";
import { matchAddressToRoster, rosterByHouseNumber } from "./address-detect";
import type { Property } from "./mock-data";
import type { ExtractedFrame } from "./video-frames";
import { ADDRESS_REVIEW_THRESHOLD } from "./geo/types";
import { sanitizeImageDataUrl } from "./image-data-url";
import { extractHouseNumber } from "./address-normalize";
import { createChatCompletion, sleep } from "./openai-retry";

/** Smaller batches + pause between calls = stay under new-account TPM caps */
const FRAMES_PER_MATCH_CALL = 2;
const PAUSE_BETWEEN_BATCHES_MS = 1200;

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

CRITICAL — HOUSE NUMBER FIRST:
- Read the mailbox / curb / door digits carefully. Digits must match what you SEE.
- Never invent or guess a house number. If unclear, set houseNumber null and needsReview true.
- matchedAddress MUST start with the same houseNumber you read (e.g. houseNumber "456" → "456 Oak Lane").
- If the street is known from context but the number is wrong on a candidate, DO NOT pick that candidate.
- Prefer a candidate whose number EXACTLY matches the visible digits. Street name is secondary.

Pipeline for EACH frame:
1. Mentally crop to mailbox, house number, curb, or door
2. Read digits first → houseNumber (string of digits only, e.g. "123")
3. Then pick matchedAddress from candidates that share THAT exact number, or build "NUMBER Street"
4. confidence 0-100 (use <${ADDRESS_REVIEW_THRESHOLD} when digits are blurry or two numbers are possible)
5. needsReview true when confidence < ${ADDRESS_REVIEW_THRESHOLD} OR digits are uncertain

Context: ${ctx.promptContext}

Candidate addresses (ONLY use one if its house number matches what you read):
${candidateBlock}

Respond JSON only:
{
  "matches": [
    {
      "frameIndex": ${startIndex},
      "visibleText": "456" or "mailbox 456 Oak" or null,
      "houseNumber": "456" or null,
      "matchedAddress": "456 Oak Lane",
      "confidence": 85,
      "needsReview": false,
      "focalRegion": "mailbox",
      "reasoning": "mailbox shows 456; matches candidate with 456"
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
      ...(() => {
        const url = sanitizeImageDataUrl(frame.dataUrl);
        if (!url) return [];
        return [
          {
            type: "image_url" as const,
            image_url: {
              url,
              // low detail keeps cost down; house-number logic still works with clear mailbox shots
              detail: "low" as const,
            },
          },
        ];
      })(),
    ]),
  ];

  const response = await createChatCompletion(
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    },
    "address-match"
  );

  const text =
    "choices" in response
      ? (response.choices[0]?.message?.content ?? "{}")
      : "{}";
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

    const rawHouse =
      (m.houseNumber || "").trim() ||
      extractHouseNumber(m.visibleText || "") ||
      extractHouseNumber(m.matchedAddress || "");

    // Prefer roster rows that share the VISIBLE house number
    let rosterMatch =
      roster.length > 0
        ? matchAddressToRoster(m.matchedAddress || "", roster, rawHouse)
        : null;

    if (!rosterMatch && rawHouse && roster.length > 0) {
      const byNum = rosterByHouseNumber(rawHouse, roster);
      if (byNum.length === 1) rosterMatch = byNum[0];
    }

    // Force address to use the visible house number when we have one
    let matchedAddress =
      m.matchedAddress?.trim() || m.visibleText?.trim() || "Unknown";
    if (rosterMatch) {
      const rosterNum = extractHouseNumber(rosterMatch.address);
      if (rawHouse && rosterNum && rosterNum === rawHouse.toLowerCase()) {
        matchedAddress = rosterMatch.address;
      } else if (rawHouse && rosterNum && rosterNum !== rawHouse.toLowerCase()) {
        // Roster pick disagrees with visible digits — keep vision number, flag review
        matchedAddress = matchedAddress.replace(/^\d+[a-z]?/i, rawHouse);
        rosterMatch = null;
      }
    } else if (rawHouse && !extractHouseNumber(matchedAddress)) {
      matchedAddress = `${rawHouse} ${matchedAddress}`.trim();
    } else if (
      rawHouse &&
      extractHouseNumber(matchedAddress) &&
      extractHouseNumber(matchedAddress) !== rawHouse.toLowerCase()
    ) {
      // GPT put the wrong number on the street — fix the digits
      matchedAddress = matchedAddress.replace(/^\d+[a-z]?/i, rawHouse);
    }

    let confidence = Math.min(99, Math.max(0, m.confidence ?? 0));
    let needsReview = m.needsReview ?? confidence < ADDRESS_REVIEW_THRESHOLD;
    if (!rawHouse) {
      needsReview = true;
      confidence = Math.min(confidence, 55);
    }

    return {
      frameIndex,
      visibleText: m.visibleText,
      houseNumber: rawHouse,
      matchedAddress,
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
    if (i > 0) await sleep(PAUSE_BETWEEN_BATCHES_MS);
    const batch = frames.slice(i, i + FRAMES_PER_MATCH_CALL);
    const matches = await matchBatch(batch, i, ctx, roster);
    all.push(...matches);
  }

  return all;
}
