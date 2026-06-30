import type { ViolationType } from "./mock-data";

export interface CcrRule {
  violationType: Exclude<ViolationType, null>;
  section: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_CCR_RULES: CcrRule[] = [
  {
    violationType: "Trash Bin Visible",
    section: "4.2",
    description: "Trash containers must not be visible from the street on non-collection days.",
    enabled: true,
  },
  {
    violationType: "Tall Grass",
    section: "6.1",
    description: "Lawn grass must not exceed 4 inches in height.",
    enabled: true,
  },
  {
    violationType: "Debris",
    section: "5.3",
    description: "Yards must be free of debris, junk, and unsightly materials.",
    enabled: true,
  },
  {
    violationType: "Dead Landscaping",
    section: "6.4",
    description: "All landscaping must be maintained in a healthy, living condition.",
    enabled: true,
  },
];

export function rulesToMap(rules: CcrRule[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rules) {
    if (r.enabled) {
      map[r.violationType] = `CC&R Section ${r.section} — ${r.description}`;
    }
  }
  return map;
}

export const CCR_STORAGE_KEY = "pp-ccr-rules";

export function loadCcrRules(): CcrRule[] {
  if (typeof window === "undefined") return DEFAULT_CCR_RULES;
  try {
    const raw = localStorage.getItem(CCR_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CcrRule[]) : DEFAULT_CCR_RULES;
  } catch {
    return DEFAULT_CCR_RULES;
  }
}

export function saveCcrRules(rules: CcrRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CCR_STORAGE_KEY, JSON.stringify(rules));
}
