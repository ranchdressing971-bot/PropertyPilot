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
  return `You are an expert at reading addresses from HOA drive-through inspection footage.

For EACH frame image, carefully look for:
- House numbers on mailboxes, curbs, driveways, or front doors
- Street name signs at intersections or on corner posts
- Address numbers on walls, gates, or packages
- Neighborhood entry signs showing street names

Infer the FULL street address when possible (e.g. "123 Oak Lane"). If you only see a house number, include it and note the street if visible in the same frame or from context.

Be thorough — drive-through videos usually pass many homes. Report every address you can read, even partially.

Respond with JSON only:
{
  "detections": [
    {
      "frameIndex": 0,
      "visibleAddress": "123 Oak Lane" or "123" or null,
      "houseNumber": "123" or null,
      "confidence": 0-100,
      "reasoning": "brief explanation of what you read"
    }
  ]
}

Include one entry per frame. Use null only when no address clues are visible.`;
}

export function buildHomeDiscoveryPrompt(frameCount: number): string {
  return `You are analyzing ${frameCount} frames from a single HOA neighborhood drive-through video.

Identify every DISTINCT home or property visible across these frames. For each unique property:
- Read the full street address from mailboxes, house numbers, signs, etc.
- If the full address is unclear, combine house number + visible street name
- If no text is readable, describe as "House near [visual landmark]" but prefer real addresses

Do NOT list the same property twice. Merge frames that show the same house.

Respond with JSON only:
{
  "homes": [
    {
      "frameIndex": 0,
      "address": "456 Maple Drive",
      "confidence": 0-100,
      "reasoning": "mailbox shows 456, street sign visible"
    }
  ]
}`;
}

/** Optional: match AI-read address to an imported roster */
export function matchAddressToRoster(
  detected: string,
  roster: Property[]
): Property | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(detected);
  if (!target) return null;

  let best: Property | null = null;
  let bestScore = 0;

  for (const prop of roster) {
    const addr = norm(prop.address);
    if (addr === target) return prop;
    if (addr.includes(target) || target.includes(addr)) {
      const score =
        Math.min(addr.length, target.length) / Math.max(addr.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        best = prop;
      }
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
