import type { Property } from "./mock-data";
import type { AddressDetection } from "./address-detect";
import type { ExtractedFrame } from "./video-frames";

export interface DiscoveredHome {
  frameIndex: number;
  address: string;
  confidence: number;
  reasoning: string;
}

function normalizeKey(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9]/g, "");
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

/** Merge detections across frames into unique properties with best frame image. */
export function discoverPropertiesFromVideo(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  neighborhood: string,
  optionalRoster?: Property[]
): Property[] {
  const groups = new Map<
    string,
    { address: string; confidence: number; frame: ExtractedFrame }
  >();

  for (const det of detections) {
    let address = pickAddress(det);
    if (!address || det.confidence < 25) continue;

    const frame =
      frames.find((f) => f.index === det.frameIndex) ?? frames[det.frameIndex];
    if (!frame) continue;

    if (optionalRoster?.length && det.matchedPropertyId) {
      const match = optionalRoster.find((p) => p.id === det.matchedPropertyId);
      if (match) address = match.address;
    }

    const numOnly = /^\d+[a-z]?$/i.test(address);
    const key = numOnly ? `num-${address}` : normalizeKey(address);

    const existing = groups.get(key);
    if (!existing || det.confidence > existing.confidence) {
      groups.set(key, { address, confidence: det.confidence, frame });
    }
  }

  mergeHouseNumberWithStreet(groups, detections, frames);

  return Array.from(groups.values()).map((g, i) => ({
    id: `found-${i + 1}`,
    address: g.address,
    image: g.frame.dataUrl,
    status: "Good Standing" as const,
    lastInspection: "—",
    neighborhood,
  }));
}

/** e.g. merge "123" with "123 Main St" when house numbers match */
function mergeHouseNumberWithStreet(
  groups: Map<string, { address: string; confidence: number; frame: ExtractedFrame }>,
  detections: AddressDetection[],
  frames: ExtractedFrame[]
): void {
  for (const det of detections) {
    const full = det.visibleAddress?.trim();
    if (!full || det.confidence < 25) continue;
    const num = full.match(/^(\d+[a-z]?)/i)?.[1];
    if (!num) continue;

    const numKey = `num-${num}`;
    const partial = groups.get(numKey);
    if (partial && full.length > partial.address.length) {
      groups.delete(numKey);
      groups.set(normalizeKey(full), {
        address: full,
        confidence: Math.max(partial.confidence, det.confidence),
        frame: frames[det.frameIndex] ?? partial.frame,
      });
    }
  }
}

export function propertiesFromHomeDiscovery(
  frames: ExtractedFrame[],
  homes: DiscoveredHome[],
  neighborhood: string
): Property[] {
  const seen = new Set<string>();
  const props: Property[] = [];

  for (const home of homes) {
    const addr = home.address?.trim();
    if (!addr || home.confidence < 30) continue;
    const key = normalizeKey(addr);
    if (seen.has(key)) continue;
    seen.add(key);

    const frame = frames[home.frameIndex] ?? frames[0];
    props.push({
      id: `found-${props.length + 1}`,
      address: addr,
      image: frame?.dataUrl ?? "",
      status: "Good Standing",
      lastInspection: "—",
      neighborhood,
    });
  }

  return props;
}

/** Last resort: one entry per frame so compliance scan still runs */
export function propertiesFromFrameFallback(
  frames: ExtractedFrame[],
  neighborhood: string
): Property[] {
  return frames.map((frame, i) => ({
    id: `found-${i + 1}`,
    address: `Home at ${formatVideoTime(frame.timestamp)}`,
    image: frame.dataUrl,
    status: "Good Standing" as const,
    lastInspection: "—",
    neighborhood,
  }));
}

/** Pad scan results with per-frame entries when address OCR finds too few homes. */
export function supplementPropertiesFromFrames(
  existing: Property[],
  frames: ExtractedFrame[],
  neighborhood: string,
  targetMin: number
): Property[] {
  if (existing.length >= targetMin || frames.length === 0) return existing;

  const merged = [...existing];
  const seenAddresses = new Set(existing.map((p) => normalizeKey(p.address)));

  for (const frame of frames) {
    if (merged.length >= targetMin) break;

    const address = `Home at ${formatVideoTime(frame.timestamp)}`;
    const key = normalizeKey(address);
    if (seenAddresses.has(key)) continue;

    seenAddresses.add(key);
    merged.push({
      id: `found-${merged.length + 1}`,
      address,
      image: frame.dataUrl,
      status: "Good Standing",
      lastInspection: "—",
      neighborhood,
    });
  }

  return merged;
}

// Legacy exports kept for optional roster matching
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

/** @deprecated Use discoverPropertiesFromVideo */
export function propertiesFromDetections(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  neighborhood: string
): Property[] {
  return discoverPropertiesFromVideo(frames, detections, neighborhood);
}
