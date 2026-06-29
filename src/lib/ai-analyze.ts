import { Property, Violation, ViolationType } from "./mock-data";

export interface AIPropertyResult {
  propertyId: string;
  address: string;
  violationType: ViolationType;
  confidence: number;
  recommendation: string;
  reasoning: string;
  rule: string;
}

export interface AIInspectionData {
  id: string;
  name: string;
  date: string;
  videoName: string;
  neighborhood: string;
  aiPowered: true;
  results: AIPropertyResult[];
  violations: Violation[];
}

const VIOLATION_RULES: Record<string, string> = {
  "Trash Bin Visible":
    "CC&R Section 4.2 — Trash containers must not be visible from the street on non-collection days.",
  "Tall Grass":
    "CC&R Section 6.1 — Lawn grass must not exceed 4 inches in height.",
  Debris:
    "CC&R Section 5.3 — Yards must be free of debris, junk, and unsightly materials.",
  "Dead Landscaping":
    "CC&R Section 6.4 — All landscaping must be maintained in a healthy, living condition.",
};

const RECOMMENDATIONS: Record<string, string> = {
  "Trash Bin Visible": "Issue Warning",
  "Tall Grass": "Manager Review",
  Debris: "Issue Warning",
  "Dead Landscaping": "Manager Review",
};

const VALID_TYPES = [
  "Trash Bin Visible",
  "Tall Grass",
  "Debris",
  "Dead Landscaping",
  null,
] as const;

interface RawAIResult {
  propertyId: string;
  violationType: string | null;
  confidence: number;
  reasoning: string;
}

export function buildViolationsFromAI(
  inspectionId: string,
  results: AIPropertyResult[]
): Violation[] {
  return results
    .filter((r) => r.violationType)
    .map((r, i) => ({
      id: `${inspectionId}-viol-${i + 1}`,
      propertyId: r.propertyId,
      type: r.violationType,
      confidence: r.confidence,
      recommendation: r.recommendation,
      rule: r.rule,
      reasoning: r.reasoning,
      evidenceImages: [],
      status: "pending" as const,
      inspectionId,
      detectedAt: new Date().toISOString(),
    }));
}

export function normalizeAIResults(
  raw: RawAIResult[],
  properties: Property[]
): AIPropertyResult[] {
  return properties.map((prop) => {
    const match = raw.find((r) => r.propertyId === prop.id);
    const type = VALID_TYPES.includes(match?.violationType as ViolationType)
      ? (match?.violationType as ViolationType)
      : null;

    return {
      propertyId: prop.id,
      address: prop.address,
      violationType: type,
      confidence: type ? Math.min(99, Math.max(60, match?.confidence ?? 80)) : 0,
      recommendation: type ? RECOMMENDATIONS[type] ?? "Manager Review" : "",
      reasoning:
        match?.reasoning ??
        (type
          ? `AI detected a potential ${type.toLowerCase()} violation at this property.`
          : "No violations detected. Property appears well-maintained."),
      rule: type ? VIOLATION_RULES[type] : "",
    };
  });
}

export function buildInspectionPrompt(batch: Property[]): string {
  const list = batch
    .map((p) => `- ID: ${p.id}, Address: ${p.address}`)
    .join("\n");

  return `You are an HOA compliance inspector analyzing drive-through video frames of residential properties.

For EACH property below, examine its image and determine if any of these violations exist:
- "Trash Bin Visible" — trash containers visible from street on non-collection days
- "Tall Grass" — lawn exceeds ~4 inches
- "Debris" — junk, construction materials, or clutter in yard
- "Dead Landscaping" — brown/dying plants or shrubs
- null — property is in good standing, no violations

Properties in this batch:
${list}

Respond with JSON only:
{
  "results": [
    {
      "propertyId": "prop-1",
      "violationType": "Trash Bin Visible" | "Tall Grass" | "Debris" | "Dead Landscaping" | null,
      "confidence": 0-100,
      "reasoning": "2-3 sentence professional explanation of what you observed"
    }
  ]
}

Include one entry per property. Be realistic — most properties should have no violations.`;
}
