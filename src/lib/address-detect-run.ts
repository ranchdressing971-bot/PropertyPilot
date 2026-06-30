import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { getOpenAI } from "./openai";
import {
  attachRosterMatches,
  buildAddressDetectionPrompt,
  type AddressDetection,
} from "./address-detect";
import type { Property } from "./mock-data";

const FRAMES_PER_VISION_CALL = 8;

async function detectBatch(
  imageUrls: string[],
  startIndex: number,
  roster: Property[]
): Promise<AddressDetection[]> {
  const content: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `${buildAddressDetectionPrompt()}\n\nFrame indices in this batch start at ${startIndex}.`,
    },
    ...imageUrls.flatMap((url, i) => [
      { type: "text" as const, text: `Frame ${startIndex + i}:` },
      { type: "image_url" as const, image_url: { url, detail: "low" as const } },
    ]),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as {
    detections?: {
      frameIndex: number;
      visibleAddress: string | null;
      houseNumber: string | null;
      confidence: number;
      reasoning: string;
    }[];
  };

  const raw = (parsed.detections ?? []).map((d) => ({
    ...d,
    frameIndex: d.frameIndex >= startIndex ? d.frameIndex : startIndex + d.frameIndex,
  }));

  return attachRosterMatches(raw, roster);
}

/** Run address OCR across all video frames (batched for token limits). */
export async function runAddressDetection(
  imageUrls: string[],
  roster: Property[]
): Promise<AddressDetection[]> {
  const all: AddressDetection[] = [];

  for (let i = 0; i < imageUrls.length; i += FRAMES_PER_VISION_CALL) {
    const batch = imageUrls.slice(i, i + FRAMES_PER_VISION_CALL);
    const detections = await detectBatch(batch, i, roster);
    all.push(...detections);
  }

  return all;
}
