import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import {
  attachRosterMatches,
  buildAddressDetectionPrompt,
  buildHomeDiscoveryPrompt,
  type AddressDetection,
} from "./address-detect";
import type { DiscoveredHome } from "./frame-property-map";
import { pickHomeDiscoveryIndices } from "./home-discovery-sample";
import type { Property } from "./mock-data";
import { sanitizeImageDataUrl } from "./image-data-url";
import { createChatCompletion, mapPool } from "./openai-retry";
import { parseAiJson } from "./parse-ai-json";

const FRAMES_PER_VISION_CALL = 4;
const BATCH_CONCURRENCY = 2;

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
    ...imageUrls.flatMap((url, i) => {
      const clean = sanitizeImageDataUrl(url);
      if (!clean) {
        return [
          {
            type: "text" as const,
            text: `Frame ${startIndex + i}: [invalid image]`,
          },
        ];
      }
      return [
        { type: "text" as const, text: `Frame ${startIndex + i}:` },
        {
          type: "image_url" as const,
          image_url: { url: clean, detail: "high" as const },
        },
      ];
    }),
  ];

  const response = await createChatCompletion(
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    },
    "address-detect"
  );

  const text =
    "choices" in response
      ? (response.choices[0]?.message?.content ?? "{}")
      : "{}";
  const parsed = parseAiJson<{
    detections?: {
      frameIndex: number;
      visibleAddress: string | null;
      houseNumber: string | null;
      confidence: number;
      reasoning: string;
    }[];
  }>(text, { detections: [] });

  const raw = (parsed.detections ?? []).map((d) => ({
    ...d,
    frameIndex:
      d.frameIndex >= startIndex ? d.frameIndex : startIndex + d.frameIndex,
  }));

  return roster.length > 0
    ? attachRosterMatches(raw, roster)
    : raw.map((d) => ({ ...d, matchedPropertyId: null }));
}

/** Per-frame address OCR across the video — up to 2 batches at once. */
export async function runAddressDetection(
  imageUrls: string[],
  roster: Property[] = []
): Promise<AddressDetection[]> {
  const batches: { start: number; urls: string[] }[] = [];
  for (let i = 0; i < imageUrls.length; i += FRAMES_PER_VISION_CALL) {
    batches.push({
      start: i,
      urls: imageUrls.slice(i, i + FRAMES_PER_VISION_CALL),
    });
  }

  const results = await mapPool(batches, BATCH_CONCURRENCY, (batch) =>
    detectBatch(batch.urls, batch.start, roster)
  );

  return results.flat();
}

/** Holistic pass: find distinct homes and addresses across all frames */
export async function runHomeDiscovery(
  imageUrls: string[],
  contentScores?: Array<number | undefined>
): Promise<DiscoveredHome[]> {
  // Prefer contentful frames + even temporal spread (max 12). Map model
  // frameIndex (sample position) back to the original extracted-frame index.
  const sourceIndices = pickHomeDiscoveryIndices(
    imageUrls.length,
    contentScores
  );
  const sample = sourceIndices.map((i) => imageUrls[i]);

  const content: ChatCompletionContentPart[] = [
    { type: "text", text: buildHomeDiscoveryPrompt(sample.length) },
    ...sample.flatMap((url, i) => {
      const clean = sanitizeImageDataUrl(url);
      if (!clean) {
        return [{ type: "text" as const, text: `Frame ${i}: [invalid image]` }];
      }
      return [
        { type: "text" as const, text: `Frame ${i}:` },
        {
          type: "image_url" as const,
          image_url: { url: clean, detail: "high" as const },
        },
      ];
    }),
  ];

  const response = await createChatCompletion(
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    },
    "home-discovery"
  );

  const text =
    "choices" in response
      ? (response.choices[0]?.message?.content ?? "{}")
      : "{}";
  const parsed = parseAiJson<{ homes?: DiscoveredHome[] }>(text, { homes: [] });
  return (parsed.homes ?? []).map((home) => {
    const sampleIdx = home.frameIndex;
    const mapped =
      Number.isFinite(sampleIdx) &&
      sampleIdx >= 0 &&
      sampleIdx < sourceIndices.length
        ? sourceIndices[sampleIdx]
        : sampleIdx;
    return { ...home, frameIndex: mapped };
  });
}
