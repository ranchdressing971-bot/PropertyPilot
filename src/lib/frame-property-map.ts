import type { Property } from "./mock-data";
import type { AddressDetection } from "./address-detect";
import type { ExtractedFrame } from "./video-frames";

export interface PropertyFrameAssignment {
  propertyId: string;
  address: string;
  frameDataUrl: string;
  frameIndex: number;
  timestamp: number;
  matchConfidence: number;
}

/**
 * Pick the best frame per roster property from address detections.
 */
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

/**
 * Create scan targets from unmatched high-confidence address reads (no roster).
 */
export function propertiesFromDetections(
  frames: ExtractedFrame[],
  detections: AddressDetection[],
  neighborhood: string
): Property[] {
  const seen = new Set<string>();
  const props: Property[] = [];

  for (const det of detections) {
    if (!det.visibleAddress || det.confidence < 50) continue;
    const key = det.visibleAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const frame = frames[det.frameIndex];
    props.push({
      id: `detected-${props.length + 1}`,
      address: det.visibleAddress,
      image: frame?.dataUrl ?? "",
      status: "Good Standing",
      lastInspection: "—",
      neighborhood,
    });
  }

  return props;
}

/**
 * Merge roster entries with their matched video frames for AI analysis.
 */
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
