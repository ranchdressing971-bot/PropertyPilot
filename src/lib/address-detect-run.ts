import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { getOpenAI } from "./openai";
import {
  attachRosterMatches,
  buildAddressDetectionPrompt,
  buildHomeDiscoveryPrompt,
  type AddressDetection,
} from "./address-detect";
import type { DiscoveredHome } from "./frame-property-map";
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
    max_tokens: 2000,
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

  return roster.length > 0 ? attachRosterMatches(raw, roster) : raw.map((d) => ({ ...d, matchedPropertyId: null }));
}

/** Per-frame address OCR across the video */
export async function runAddressDetection(
  imageUrls: string[],
  roster: Property[] = []
): Promise<AddressDetection[]> {
  const all: AddressDetection[] = [];

  for (let i = 0; i < imageUrls.length; i += FRAMES_PER_VISION_CALL) {
    const batch = imageUrls.slice(i, i + FRAMES_PER_VISION_CALL);
    const detections = await detectBatch(batch, i, roster);
    all.push(...detections);
  }

  return all;
}

/** Holistic pass: find distinct homes and addresses across all frames */
export async function runHomeDiscovery(
  imageUrls: string[]
): Promise<DiscoveredHome[]> {
  const sample = imageUrls.length > 12
    ? imageUrls.filter((_, i) => i % Math.ceil(imageUrls.length / 12) === 0)
    : imageUrls;

  const content: ChatCompletionContentPart[] = [
    { type: "text", text: buildHomeDiscoveryPrompt(sample.length) },
    ...sample.flatMap((url, i) => [
      { type: "text" as const, text: `Frame ${i}:` },
      { type: "image_url" as const, image_url: { url, detail: "low" as const } },
    ]),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { homes?: DiscoveredHome[] };
  return parsed.homes ?? [];
}
