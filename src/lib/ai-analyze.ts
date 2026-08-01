import { Property, Violation, ViolationType } from "./mock-data";

export interface AIPropertyResult {
  propertyId: string;
  address: string;
  violationType: ViolationType;
  confidence: number;
  recommendation: string;
  reasoning: string;
  rule: string;
  previouslyInspected?: boolean;
  priorInspectionDate?: string;
}

export interface AddressReviewItem {
  propertyId: string;
  address: string;
  confidence: number;
  needsReview: boolean;
  reasoning?: string;
}

/** Soft community fingerprint check attached after analysis. */
export interface CommunityVerificationSummary {
  outcome:
    | "bootstrap"
    | "match"
    | "small_expansion"
    | "large_difference"
    | "ignored_new"
    | "expanded"
    | "new_community_suggested";
  eventId: string | null;
  fingerprintId: string | null;
  matchRatio: number;
  knownCount: number;
  newCount: number;
  newAddresses: string[];
  helpfulMessage: string;
  needsUserAction: boolean;
  flaggedForReview: boolean;
  communityName: string;
}

export interface AIInspectionData {
  id: string;
  name: string;
  date: string;
  videoName: string;
  neighborhood: string;
  /** Linked communities row when selected at upload */
  communityId?: string;
  aiPowered: true;
  results: AIPropertyResult[];
  violations: Violation[];
  /** Frames extracted from uploaded video */
  frameCount?: number;
  /** Properties matched to frames via address OCR */
  addressMatches?: number;
  usedVideoFrames?: boolean;
  /** GPS + roster assisted address pipeline was used */
  usedGpsPipeline?: boolean;
  /** Per-property address confidence for human review */
  addressReviews?: AddressReviewItem[];
  /** HTTPS URLs for property frame thumbnails (keyed by propertyId) */
  propertyImages?: Record<string, string>;
  /** Homes skipped because they were already inspected in a prior session */
  previouslyInspectedCount?: number;
  /** Soft community verification vs fingerprint (never blocks save) */
  communityVerification?: CommunityVerificationSummary;
}

const VIOLATION_RULES: Record<string, string> = {
  "Trash Bin Visible":
    "CC&R Section 4.2: Trash containers must not be visible from the street on non-collection days.",
  "Tall Grass":
    "CC&R Section 6.1: Lawn grass must not exceed 4 inches in height.",
  Debris:
    "CC&R Section 5.3: Yards must be free of debris, junk, and unsightly materials.",
  "Dead Landscaping":
    "CC&R Section 6.4: All landscaping must be maintained in a healthy, living condition.",
};

const RECOMMENDATIONS: Record<string, string> = {
  "Trash Bin Visible": "Issue Warning",
  "Tall Grass": "Manager Review",
  Debris: "Issue Warning",
  "Dead Landscaping": "Manager Review",
};

const FALLBACK_BUILTIN_TYPES = new Set(Object.keys(VIOLATION_RULES));

/** Resolve AI type against enabled rules (builtins + customs). */
function resolveViolationType(
  rawType: string | null | undefined,
  enabledTypes: Set<string>
): ViolationType {
  if (!rawType || typeof rawType !== "string") return null;
  const trimmed = rawType.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  if (enabledTypes.has(trimmed)) return trimmed;
  // Case-insensitive match to enabled rule names (custom or built-in)
  const lower = trimmed.toLowerCase();
  for (const enabled of enabledTypes) {
    if (enabled.toLowerCase() === lower) return enabled;
  }
  return null;
}

interface RawAIResult {
  propertyId: string;
  violationType: string | null;
  confidence: number;
  reasoning: string;
}

export function buildViolationsFromAI(
  inspectionId: string,
  results: AIPropertyResult[],
  ruleMap?: Record<string, string>
): Violation[] {
  const rules = ruleMap ?? VIOLATION_RULES;
  return results
    .filter((r) => r.violationType)
    .map((r, i) => ({
      id: `${inspectionId}-viol-${i + 1}`,
      propertyId: r.propertyId,
      type: r.violationType,
      confidence: r.confidence,
      recommendation: r.recommendation,
      rule: r.rule || (r.violationType ? rules[r.violationType] ?? "" : ""),
      reasoning: r.reasoning,
      evidenceImages: [],
      status: "pending" as const,
      inspectionId,
      detectedAt: new Date().toISOString(),
    }));
}

export function normalizeAIResults(
  raw: RawAIResult[],
  properties: Property[],
  ruleMap?: Record<string, string>,
  opts?: { enforceTrashBins?: boolean }
): AIPropertyResult[] {
  const rules = ruleMap ?? VIOLATION_RULES;
  const enabledTypes = new Set(Object.keys(rules));
  const enforceTrash = opts?.enforceTrashBins !== false;

  // When caller omitted ruleMap, allow built-ins; empty ruleMap means all toggled off
  const allowed = ruleMap != null ? enabledTypes : FALLBACK_BUILTIN_TYPES;

  return properties.map((prop) => {
    const match = raw.find((r) => r.propertyId === prop.id);
    let type = resolveViolationType(match?.violationType, allowed);

    // Pickup day — bins allowed at curb; don't create enforceable flags
    if (type === "Trash Bin Visible" && !enforceTrash) {
      return {
        propertyId: prop.id,
        address: prop.address,
        violationType: null,
        confidence: 0,
        recommendation: "",
        reasoning:
          "Trash bin visible, but today is a scheduled collection day — not flagged per HOA schedule.",
        rule: "",
      };
    }

    // Honest confidence — no artificial 60 floor
    const confidence = type
      ? Math.min(100, Math.max(0, Math.round(match?.confidence ?? 0)))
      : 0;

    return {
      propertyId: prop.id,
      address: prop.address,
      violationType: type,
      confidence,
      recommendation: type ? RECOMMENDATIONS[type] ?? "Manager Review" : "",
      reasoning:
        match?.reasoning ??
        (type
          ? `AI detected a potential ${type.toLowerCase()} violation at this property.`
          : "No violations detected. Property appears well-maintained."),
      rule: type ? rules[type] ?? VIOLATION_RULES[type] ?? "" : "",
    };
  });
}

export function buildInspectionPrompt(
  batch: Property[],
  ruleMap?: Record<string, string>,
  opts?: { collectionDaysLabel?: string; isCollectionDay?: boolean }
): string {
  const rules = ruleMap ?? VIOLATION_RULES;
  const ruleLines = Object.entries(rules)
    .map(([type, rule]) => `- "${type}" — ${rule}`)
    .join("\n");

  const list = batch
    .map((p) => `- ID: ${p.id}, Address: ${p.address}`)
    .join("\n");

  const trashNote =
    opts?.isCollectionDay === true
      ? `\nIMPORTANT — Today IS a trash collection day (${opts.collectionDaysLabel ?? "scheduled"}). Do NOT flag "Trash Bin Visible" — bins are allowed at the curb. Prefer null for bins-only findings.`
      : opts?.isCollectionDay === false
        ? `\nTrash schedule: collection days are ${opts.collectionDaysLabel ?? "configured"}. Today is NOT a collection day — visible curb bins may be flagged as "Trash Bin Visible".`
        : "";

  const typeUnion =
    Object.keys(rules)
      .map((t) => `"${t.replace(/"/g, "")}"`)
      .join(" | ") || '"Trash Bin Visible" | "Tall Grass" | "Debris" | "Dead Landscaping"';

  return `You are an HOA compliance inspector analyzing drive-through video frames of residential properties.

For EACH property below, examine its image and determine if any of these HOA/community violations exist:
${ruleLines}
- null: property is in good standing, no violations
${trashNote}

Properties in this batch:
${list}

Respond with JSON only:
{
  "results": [
    {
      "propertyId": "prop-1",
      "violationType": ${typeUnion} | null,
      "confidence": 0-100,
      "reasoning": "2-3 sentence professional explanation of what you observed"
    }
  ]
}

Be strict:
- Only flag a violation if it is clearly visible from the street (curb / driveway / front lot) in that property's frame.
- Do NOT invent addresses. Use the propertyId and Address given.
- Drive-through footage is often angled; judge the lot in the frame, not the neighbor across the street.
- Tall grass only if lawn is clearly overgrown on that lot (not a distant median or roadside strip).
- For custom rules, match the description: only flag when the described condition is curb-visible.
- Prefer null (good standing) when unsure. Most homes should be null.
- confidence below 70 means you should return null instead.
- Use exactly one violationType string from the list above (or null). Do not invent new type names.`;
}
