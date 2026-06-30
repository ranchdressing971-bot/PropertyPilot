import type { Property } from "./mock-data";

export interface AddressDetection {
  frameIndex: number;
  visibleAddress: string | null;
  houseNumber: string | null;
  confidence: number;
  reasoning: string;
  matchedPropertyId: string | null;
}

export function buildAddressDetectionPrompt(): string {
  return `You are reading street-level video frames from an HOA drive-through inspection.

For each image, detect any visible:
- House numbers on mailboxes, curbs, or facades
- Street address signs or name plates
- Street sign text

Respond with JSON only:
{
  "detections": [
    {
      "frameIndex": 0,
      "visibleAddress": "123 Main St" or null,
      "houseNumber": "123" or null,
      "confidence": 0-100,
      "reasoning": "brief explanation"
    }
  ]
}`;
}

/** Fuzzy-match detected address text to roster entries. */
export function matchAddressToRoster(
  detected: string,
  roster: Property[]
): Property | null {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const target = norm(detected);
  if (!target) return null;

  let best: Property | null = null;
  let bestScore = 0;

  for (const prop of roster) {
    const addr = norm(prop.address);
    if (addr === target) return prop;
    if (addr.includes(target) || target.includes(addr)) {
      const score = Math.min(addr.length, target.length) / Math.max(addr.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        best = prop;
      }
    }
    const num = prop.address.match(/^\d+/)?.[0];
    if (num && target.startsWith(num) && bestScore < 0.5) {
      bestScore = 0.5;
      best = prop;
    }
  }

  return bestScore >= 0.4 ? best : null;
}

export function attachRosterMatches(
  detections: Omit<AddressDetection, "matchedPropertyId">[],
  roster: Property[]
): AddressDetection[] {
  return detections.map((d) => ({
    ...d,
    matchedPropertyId: d.visibleAddress
      ? matchAddressToRoster(d.visibleAddress, roster)?.id ?? null
      : null,
  }));
}
