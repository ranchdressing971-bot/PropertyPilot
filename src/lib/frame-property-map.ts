import type { AddressMatchResult } from "./address-match-run";
import type { Property } from "./mock-data";
import type { AddressDetection } from "./address-detect";
import type { ExtractedFrame } from "./video-frames";
import {
  addressDedupeKey,
  addressesLikelySame,
  extractHouseNumber,
  formatAddressTitle,
  isPlaceholderAddress,
  pickBetterAddress,
} from "./address-normalize";

export interface DiscoveredHome {
  frameIndex: number;
  address: string;
  confidence: number;
  reasoning: string;
}

/** Min seconds between distinct homes — keep short so adjacent lots aren't merged. */
const TEMPORAL_GAP_SEC = 3.5;

function stablePropertyId(address: string, rosterId?: string): string {
  if (rosterId && !rosterId.startsWith("found-") && !rosterId.includes(" ")) {
    return rosterId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  }
  const key = addressDedupeKey(address)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `addr-${key || "unknown"}`;
}

function formatVideoTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickAddress(det: AddressDetection): string | null {
  const full = det.visibleAddress?.trim();
  if (full && full.length > 2) return full;
  if (det.houseNumber?.trim()) return det.houseNumber.trim();
  return null;
}

function frameForImage(frames: ExtractedFrame[], image: string): ExtractedFrame | undefined {
  return frames.find((f) => f.dataUrl === image);
}

interface PropertyCandidate {
  address: string;
  confidence: number;
  frame: ExtractedFrame;
  id?: string;
  addressConfidence?: number;
  needsAddressReview?: boolean;
  addressMatchReason?: string;
}

function candidateToProperty(
  candidate: PropertyCandidate,
  neighborhood: string,
  id: string
): Property {
  const confidence =
    candidate.addressConfidence ?? candidate.confidence ?? 0;
  const needsReview =
    candidate.needsAddressReview ??
    (confidence < 70 || !extractHouseNumber(candidate.address));

  return {
    id: candidate.id ?? id,
    address: formatAddressTitle(candidate.address),
    image: candidate.frame.dataUrl,
    status: "Good Standing",
    lastInspection: "—",
    neighborhood,
    addressConfidence: confidence,
    needsAddressReview: needsReview,
    addressMatchReason: candidate.addressMatchReason,
  };
}

/** Merge duplicate addresses; keep best label + highest-confidence frame. */
export function dedupeProperties(
  properties: Property[],
  frames: ExtractedFrame[] = [],
  neighborhood = ""
): Property[] {
  const hood = neighborhood || properties[0]?.neighborhood || "";
  const groups: PropertyCandidate[] = [];

  for (const prop of properties) {
    const frame =
      frameForImage(frames, prop.image) ??
      ({ index: 0, timestamp: 0, dataUrl: prop.image } as ExtractedFrame);

    const existingIdx = groups.findIndex((g) =>
      addressesLikelySame(g.address, prop.address)
    );

    if (existingIdx === -1) {
      groups.push({
        address: prop.address,
        confidence: prop.addressConfidence ?? 70,
        frame,
        id: prop.id,
        addressConfidence: prop.addressConfidence,
        needsAddressReview: prop.needsAddressReview,
        addressMatchReason: prop.addressMatchReason,
      });
      continue;
    }

    const existing = groups[existingIdx];
    existing.address = pickBetterAddress(existing.address, prop.address);
    if (!isPlaceholderAddress(prop.address) && isPlaceholderAddress(existing.address)) {
      existing.frame = frame;
    }
    if (
      (prop.addressConfidence ?? 0) > (existing.addressConfidence ?? 0) ||
      (!isPlaceholderAddress(prop.address) && isPlaceholderAddress(existing.address))
    ) {
      existing.frame = frame;
      existing.confidence = Math.max(existing.confidence, prop.addressConfidence ?? 70);
      existing.addressConfidence = prop.addressConfidence ?? existing.addressConfidence;
      existing.addressMatchReason = prop.addressMatchReason ?? existing.addressMatchReason;
      existing.id = prop.id;
    }
    existing.needsAddressReview =
      existing.needsAddressReview || prop.needsAddressReview || false;
  }

  // Temporal dedupe: placeholders / weak reads within TEMPORAL_GAP_SEC = same house
  const sorted = [...groups].sort((a, b) => a.frame.timestamp - b.frame.timestamp);
  const merged: PropertyCandidate[] = [];

  for (const item of sorted) {
    const prev = merged[merged.length - 1];
    const prevNum = extractHouseNumber(prev?.address ?? "");
    const itemNum = extractHouseNumber(item.address);
    // Never merge two different house numbers, even if frames are close
    const differentNumbers =
      Boolean(prevNum) && Boolean(itemNum) && prevNum !== itemNum;

    // Only merge when same home — never collapse different streets that share a number
    if (
      prev &&
      !differentNumbers &&
      Math.abs(item.frame.timestamp - prev.frame.timestamp) < TEMPORAL_GAP_SEC &&
      (isPlaceholderAddress(item.address) ||
        isPlaceholderAddress(prev.address) ||
        addressesLikelySame(item.address, prev.address))
    ) {
      prev.address = pickBetterAddress(prev.address, item.address);
      if (
        !isPlaceholderAddress(item.address) &&
        (isPlaceholderAddress(prev.address) || item.confidence > prev.confidence)
      ) {
        prev.frame = item.frame;
        prev.confidence = Math.max(prev.confidence, item.confidence);
        if ((item.addressConfidence ?? 0) >= (prev.addressConfidence ?? 0)) {
          prev.addressConfidence = item.addressConfidence ?? prev.addressConfidence;
          prev.addressMatchReason = item.addressMatchReason ?? prev.addressMatchReason;
          prev.id = item.id ?? prev.id;
        }
      }
      prev.needsAddressReview =
        prev.needsAddressReview || item.needsAddressReview || false;
      continue;
    }
    merged.push({ ...item });
  }

  return merged.map((g, i) =>
    candidateToProperty(g, hood, stablePropertyId(g.address, g.id ?? `found-${i + 1}`))
  );
}

/** Combine multiple property lists into one deduped list. */
export function mergePropertyLists(
  neighborhood: string,
  frames: ExtractedFrame[],
  ...lists: Property[][]
): Property[] {
  return dedupeProperties(lists.flat(), frames, neighborhood);
}

/** Merge detections across frames into unique properties with best frame image. */
export function discoverPropertiesFromVideo(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  neighborhood: string,
  optionalRoster?: Property[]
): Property[] {
  const groups = new Map<string, PropertyCandidate>();

  for (const det of detections) {
    let address = pickAddress(det);
    if (!address || det.confidence < 30) continue;

    const frame =
      frames.find((f) => f.index === det.frameIndex) ?? frames[det.frameIndex];
    if (!frame) continue;

    if (optionalRoster?.length && det.matchedPropertyId) {
      const match = optionalRoster.find((p) => p.id === det.matchedPropertyId);
      if (match) address = match.address;
    }

    const key = addressDedupeKey(address);
    const existing = groups.get(key);
    if (!existing || det.confidence > existing.confidence) {
      groups.set(key, {
        address,
        confidence: det.confidence,
        frame,
        addressConfidence: det.confidence,
        needsAddressReview:
          det.confidence < 70 || !extractHouseNumber(address),
        addressMatchReason: det.reasoning,
      });
    }
  }

  // Merge entries that share a house number but different keys (e.g. "123" vs "123 Oak")
  const candidates = Array.from(groups.values());
  const props = candidates.map((c, i) =>
    candidateToProperty(c, neighborhood, `found-${i + 1}`)
  );

  return dedupeProperties(props, frames);
}

/**
 * GPS + vision pipeline: group frame matches into unique properties with confidence.
 */
export function propertiesFromAddressMatches(
  matches: AddressMatchResult[],
  frames: ExtractedFrame[],
  neighborhood: string
): Property[] {
  const groups = new Map<
    string,
    {
      address: string;
      confidence: number;
      needsReview: boolean;
      reasoning: string;
      frame: ExtractedFrame;
      propertyId: string | null;
    }
  >();

  for (const m of matches) {
    let addr = m.matchedAddress?.trim();
    // Keep weak reads as needs-review instead of dropping the house entirely
    if (!addr || addr === "Unknown" || m.confidence < 10) continue;

    // Prefer visible house number over a mismatched street guess
    const visibleNum = (m.houseNumber || extractHouseNumber(m.visibleText || "") || "").toLowerCase();
    const addrNum = extractHouseNumber(addr);
    if (visibleNum && addrNum && visibleNum !== addrNum) {
      addr = addr.replace(/^\d+[a-z]?/i, m.houseNumber || visibleNum);
    } else if (visibleNum && !addrNum) {
      addr = `${m.houseNumber || visibleNum} ${addr}`.trim();
    }

    const frame =
      frames[m.frameIndex] ?? frames.find((f) => f.index === m.frameIndex);
    if (!frame) continue;

    const key = addressDedupeKey(addr);
    const existing = groups.get(key);
    const needsReview =
      m.needsReview ||
      !visibleNum ||
      (Boolean(visibleNum) && Boolean(addrNum) && visibleNum !== addrNum);

    if (!existing || m.confidence > existing.confidence) {
      groups.set(key, {
        address: addr,
        confidence: m.confidence,
        needsReview,
        reasoning: m.reasoning,
        frame,
        propertyId: m.matchedPropertyId,
      });
    } else {
      existing.needsReview = existing.needsReview || needsReview;
      // Prefer address whose house number matches the visible digits
      const existingNum = extractHouseNumber(existing.address);
      if (visibleNum && existingNum !== visibleNum) {
        existing.address = addr;
        existing.frame = frame;
        existing.confidence = m.confidence;
        existing.propertyId = m.matchedPropertyId;
      } else {
        existing.address = pickBetterAddress(existing.address, addr);
      }
    }
  }

  let idx = 0;
  const props = Array.from(groups.values()).map((g) => {
    idx += 1;
    return {
      id: g.propertyId ?? `found-${idx}`,
      address: formatAddressTitle(g.address),
      image: g.frame.dataUrl,
      status: "Good Standing" as const,
      lastInspection: "—",
      neighborhood,
      addressConfidence: g.confidence,
      needsAddressReview: g.needsReview,
      addressMatchReason: g.reasoning,
    };
  });

  return dedupeProperties(props, frames, neighborhood);
}

export function propertiesFromHomeDiscovery(
  frames: ExtractedFrame[],
  homes: DiscoveredHome[],
  neighborhood: string
): Property[] {
  const props: Property[] = [];

  for (const home of homes) {
    const addr = home.address?.trim();
    if (!addr || home.confidence < 35) continue;

    const frame = frames[home.frameIndex] ?? frames[0];
    const confidence = Math.min(99, Math.max(0, home.confidence));
    props.push({
      id: `found-${props.length + 1}`,
      address: formatAddressTitle(addr),
      image: frame?.dataUrl ?? "",
      status: "Good Standing",
      lastInspection: "—",
      neighborhood,
      addressConfidence: confidence,
      needsAddressReview:
        confidence < 70 || !extractHouseNumber(addr),
      addressMatchReason: home.reasoning,
    });
  }

  return dedupeProperties(props, frames);
}

/** One entry per frame — only when OCR finds nothing. */
export function propertiesFromFrameFallback(
  frames: ExtractedFrame[],
  neighborhood: string
): Property[] {
  const step = Math.max(1, Math.ceil(frames.length / 6));
  const picked = frames.filter((_, i) => i % step === 0).slice(0, 6);

  const props = picked.map((frame, i) => ({
    id: `found-${i + 1}`,
    address: `Home at ${formatVideoTime(frame.timestamp)}`,
    image: frame.dataUrl,
    status: "Good Standing" as const,
    lastInspection: "—",
    neighborhood,
  }));

  return dedupeProperties(props, frames);
}

/**
 * Add frame slots only for time ranges with no matched home yet.
 * Avoids duplicating houses already found by address OCR.
 */
export function supplementPropertiesFromFrames(
  existing: Property[],
  frames: ExtractedFrame[],
  neighborhood: string,
  targetMin: number
): Property[] {
  if (existing.length >= targetMin || frames.length === 0) return existing;

  const covered = new Set<number>();
  for (const prop of existing) {
    const frame = frameForImage(frames, prop.image);
    if (!frame) continue;
    const slot = Math.floor(frame.timestamp / TEMPORAL_GAP_SEC);
    covered.add(slot);
    covered.add(slot - 1);
    covered.add(slot + 1);
  }

  const extras: Property[] = [];
  for (const frame of frames) {
    if (existing.length + extras.length >= targetMin) break;

    const slot = Math.floor(frame.timestamp / TEMPORAL_GAP_SEC);
    if (covered.has(slot)) continue;

    const overlapsKnown = existing.some((prop) => {
      const knownFrame = frameForImage(frames, prop.image);
      if (!knownFrame) return false;
      return Math.abs(knownFrame.timestamp - frame.timestamp) < TEMPORAL_GAP_SEC;
    });
    if (overlapsKnown) continue;

    covered.add(slot);
    extras.push({
      id: `found-${existing.length + extras.length + 1}`,
      address: `Home at ${formatVideoTime(frame.timestamp)}`,
      image: frame.dataUrl,
      status: "Good Standing",
      lastInspection: "—",
      neighborhood,
    });
  }

  return dedupeProperties([...existing, ...extras], frames);
}

// Legacy exports
export interface PropertyFrameAssignment {
  propertyId: string;
  address: string;
  frameDataUrl: string;
  frameIndex: number;
  timestamp: number;
  matchConfidence: number;
}

export function assignFramesToRoster(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  roster: Property[]
): PropertyFrameAssignment[] {
  const byProperty = new Map<string, PropertyFrameAssignment>();

  for (const det of detections) {
    if (!det.matchedPropertyId) continue;
    const frame = frames[det.frameIndex];
    if (!frame) continue;

    const prop = roster.find((p) => p.id === det.matchedPropertyId);
    if (!prop) continue;

    const existing = byProperty.get(prop.id);
    if (!existing || det.confidence > existing.matchConfidence) {
      byProperty.set(prop.id, {
        propertyId: prop.id,
        address: prop.address,
        frameDataUrl: frame.dataUrl,
        frameIndex: frame.index,
        timestamp: frame.timestamp,
        matchConfidence: det.confidence,
      });
    }
  }

  return Array.from(byProperty.values());
}

export function buildPropertiesWithFrames(
  roster: Property[],
  assignments: PropertyFrameAssignment[]
): Property[] {
  const assignmentMap = new Map(assignments.map((a) => [a.propertyId, a]));

  return roster
    .filter((p) => assignmentMap.has(p.id))
    .map((p) => {
      const a = assignmentMap.get(p.id)!;
      return { ...p, image: a.frameDataUrl };
    });
}

export function propertiesFromDetections(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  neighborhood: string
): Property[] {
  return discoverPropertiesFromVideo(frames, detections, neighborhood);
}
