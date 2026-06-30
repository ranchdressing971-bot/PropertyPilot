import type { AIInspectionData, AddressReviewItem } from "./ai-analyze";
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
  usedGpsPipeline?: boolean;
  addressReviews?: AddressReviewItem[];
  results: {
    propertyId: string;
    property: Property;
    violation: AIInspectionData["violations"][number] | null;
  }[];
}

export function formatInspectionForDisplay(
  aiInspection: AIInspectionData
): InspectionDisplayData {
  const reviewById = new Map(
    (aiInspection.addressReviews ?? []).map((r) => [r.propertyId, r])
  );

  return {
    id: aiInspection.id,
    name: aiInspection.name,
    date: aiInspection.date,
    aiPowered: true,
    propertiesScanned: aiInspection.results.length,
    frameCount: aiInspection.frameCount,
    addressMatches: aiInspection.addressMatches,
    usedVideoFrames: aiInspection.usedVideoFrames,
    usedGpsPipeline: aiInspection.usedGpsPipeline,
    addressReviews: aiInspection.addressReviews,
    results: aiInspection.results.map((r) => {
      const violation =
        aiInspection.violations.find((v) => v.propertyId === r.propertyId) ?? null;
      const evidence =
        violation?.evidenceImages[0] ??
        aiInspection.propertyImages?.[r.propertyId] ??
        "";
      const review = reviewById.get(r.propertyId);

      return {
        propertyId: r.propertyId,
        property: {
          id: r.propertyId,
          address: r.address,
          image: evidence,
          status: violation ? "Needs Review" : "Good Standing",
          lastInspection: aiInspection.date,
          neighborhood: aiInspection.neighborhood,
          addressConfidence: review?.confidence,
          needsAddressReview: review?.needsReview,
          addressMatchReason: review?.reasoning,
        },
        violation,
      };
    }),
  };
}
