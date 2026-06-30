import type { AIInspectionData } from "./ai-analyze";
import type { Property } from "./mock-data";

export interface InspectionDisplayData {
  id: string;
  name: string;
  date: string;
  aiPowered?: boolean;
  propertiesScanned: number;
  frameCount?: number;
  addressMatches?: number;
  usedVideoFrames?: boolean;
  results: {
    propertyId: string;
    property: Property;
    violation: AIInspectionData["violations"][number] | null;
  }[];
}

export function formatInspectionForDisplay(
  aiInspection: AIInspectionData
): InspectionDisplayData {
  return {
    id: aiInspection.id,
    name: aiInspection.name,
    date: aiInspection.date,
    aiPowered: true,
    propertiesScanned: aiInspection.results.length,
    frameCount: aiInspection.frameCount,
    addressMatches: aiInspection.addressMatches,
    usedVideoFrames: aiInspection.usedVideoFrames,
    results: aiInspection.results.map((r) => {
      const violation =
        aiInspection.violations.find((v) => v.propertyId === r.propertyId) ?? null;
      const evidence =
        violation?.evidenceImages[0] ??
        aiInspection.propertyImages?.[r.propertyId] ??
        "";

      return {
        propertyId: r.propertyId,
        property: {
          id: r.propertyId,
          address: r.address,
          image: evidence,
          status: violation ? "Needs Review" : "Good Standing",
          lastInspection: aiInspection.date,
          neighborhood: aiInspection.neighborhood,
        },
        violation,
      };
    }),
  };
}
