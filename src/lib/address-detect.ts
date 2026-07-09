import type { Property } from "./mock-data";
import {
  addressDedupeKey,
  extractHouseNumber,
  streetCore,
} from "./address-normalize";

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

For EACH frame image, look for:
- House numbers on mailboxes, curbs, driveways, or front doors
- Street name signs at intersections
- Address numbers on gates or garage trim

Rules:
- Return the FULL address when possible: "123 Oak Lane" (not just "123" unless that's all you see)
- Use standard abbreviations: St, Dr, Ln, Ave, Ct, Blvd
- If the SAME house appears in multiple frames you will analyze separately, still report what you see — duplicates are merged later
- Do NOT guess street names you cannot see
- confidence 80+ only when you clearly read the number; 50-70 for partial reads

Respond with JSON only:
{
  "detections": [
    {
      "frameIndex": 0,
      "visibleAddress": "123 Oak Lane" or null,
      "houseNumber": "123" or null,
      "confidence": 0-100,
      "reasoning": "mailbox shows 123 Oak Ln"
    }
  ]
}

One entry per frame. Use null only when no address clues are visible.`;
}

export function buildHomeDiscoveryPrompt(frameCount: number): string {
  return `You are analyzing ${frameCount} frames from ONE continuous HOA drive-through video.

List each DISTINCT home visible across all frames — each physical house ONCE.

How to identify unique homes:
- Same mailbox/house number in nearby frames = ONE home (pick the clearest frame)
- Different house numbers = different homes
- A house usually takes 2-4 seconds in a slow drive-through — do not list it twice

For each unique home:
- Prefer full address: "456 Maple Drive"
- If only number visible: "456" plus any visible street name
- confidence: 85+ clear mailbox, 60-75 partial

Respond with JSON only:
{
  "homes": [
    {
      "frameIndex": 0,
      "address": "456 Maple Drive",
      "confidence": 0-100,
      "reasoning": "mailbox 456, street sign Maple Dr"
    }
  ]
}`;
}

/** Optional: match AI-read address to an imported roster (strict house # + street). */
export function matchAddressToRoster(
  detected: string,
  roster: Property[],
  visibleHouseNumber?: string | null
): Property | null {
  const target = detected.trim();
  if (!target && !visibleHouseNumber) return null;

  const targetKey = target ? addressDedupeKey(target) : "";
  const targetNum =
    (visibleHouseNumber || "").trim().toLowerCase() ||
    (target ? extractHouseNumber(target) : null);
  const targetStreet = target ? streetCore(target) : "";

  // Exact normalized key wins immediately
  if (targetKey) {
    for (const prop of roster) {
      if (addressDedupeKey(prop.address) === targetKey) return prop;
    }
  }

  // Require a house number — never match street-only
  if (!targetNum) return null;

  const numberMatches = roster.filter((prop) => {
    const propNum = extractHouseNumber(prop.address);
    return propNum && propNum === targetNum;
  });

  if (numberMatches.length === 0) return null;
  if (numberMatches.length === 1 && !targetStreet) {
    // Only one home with that number on the roster — accept it
    return numberMatches[0];
  }

  let best: Property | null = null;
  let bestScore = 0;

  for (const prop of numberMatches) {
    const propStreet = streetCore(prop.address);
    if (!targetStreet || !propStreet) {
      // Prefer exact number-only when street unknown, but only if unique
      if (numberMatches.length === 1) return prop;
      continue;
    }

    if (propStreet === targetStreet) return prop;

    const shorter =
      propStreet.length <= targetStreet.length ? propStreet : targetStreet;
    const longer =
      propStreet.length > targetStreet.length ? propStreet : targetStreet;
    if (longer.startsWith(shorter) && shorter.length >= 4) {
      const score = shorter.length / longer.length;
      if (score > bestScore) {
        bestScore = score;
        best = prop;
      }
    }
  }

  // Raised threshold — only strong street-prefix overlap
  return bestScore >= 0.85 ? best : null;
}

/** Find roster homes that share an exact house number. */
export function rosterByHouseNumber(
  houseNumber: string | null | undefined,
  roster: Property[]
): Property[] {
  const num = (houseNumber || "").trim().toLowerCase();
  if (!num) return [];
  return roster.filter((p) => extractHouseNumber(p.address) === num);
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
