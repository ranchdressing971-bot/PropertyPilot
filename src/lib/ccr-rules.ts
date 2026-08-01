import {
  BUILTIN_VIOLATION_TYPES,
  type BuiltinViolationType,
} from "./mock-data";

export interface CcrRule {
  /** Stable id: `builtin:…` or `custom:…` */
  id: string;
  /** Display / AI violation type name */
  violationType: string;
  section: string;
  /** What to look for (street-visible cues) */
  description: string;
  enabled: boolean;
  /** User-added; editable and deletable in Settings */
  custom?: boolean;
}

const BUILTIN_SET = new Set<string>(BUILTIN_VIOLATION_TYPES);

export const DEFAULT_CCR_RULES: CcrRule[] = [
  {
    id: "builtin:Trash Bin Visible",
    violationType: "Trash Bin Visible",
    section: "4.2",
    description:
      "Trash containers must not be visible from the street on non-collection days.",
    enabled: true,
    custom: false,
  },
  {
    id: "builtin:Tall Grass",
    violationType: "Tall Grass",
    section: "6.1",
    description: "Lawn grass must not exceed 4 inches in height.",
    enabled: true,
    custom: false,
  },
  {
    id: "builtin:Debris",
    violationType: "Debris",
    section: "5.3",
    description: "Yards must be free of debris, junk, and unsightly materials.",
    enabled: true,
    custom: false,
  },
  {
    id: "builtin:Dead Landscaping",
    violationType: "Dead Landscaping",
    section: "6.4",
    description:
      "All landscaping must be maintained in a healthy, living condition.",
    enabled: true,
    custom: false,
  },
];

export function isBuiltinRule(rule: CcrRule): boolean {
  return rule.custom !== true && BUILTIN_SET.has(rule.violationType);
}

export function isBuiltinViolationType(
  type: string
): type is BuiltinViolationType {
  return BUILTIN_SET.has(type);
}

function newCustomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalize stored JSON (localStorage / profiles.ccr_rules) into builtins + customs. */
export function normalizeCcrRules(stored: unknown): CcrRule[] {
  const list = Array.isArray(stored) ? stored : [];
  const enabledByBuiltin = new Map<string, boolean>();
  const customs: CcrRule[] = [];
  const seenCustomNames = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<CcrRule>;
    const name =
      typeof r.violationType === "string" ? r.violationType.trim() : "";
    if (!name) continue;

    const markedCustom =
      r.custom === true ||
      (typeof r.id === "string" && r.id.startsWith("custom:"));

    if (!markedCustom && BUILTIN_SET.has(name)) {
      if (typeof r.enabled === "boolean") {
        enabledByBuiltin.set(name, r.enabled);
      }
      continue;
    }

    const key = name.toLowerCase();
    if (seenCustomNames.has(key) || BUILTIN_SET.has(name)) continue;
    seenCustomNames.add(key);

    customs.push({
      id:
        typeof r.id === "string" && r.id.startsWith("custom:")
          ? r.id
          : newCustomId(),
      violationType: name,
      section:
        typeof r.section === "string" && r.section.trim()
          ? r.section.trim()
          : "Custom",
      description: typeof r.description === "string" ? r.description.trim() : "",
      enabled: r.enabled !== false,
      custom: true,
    });
  }

  const builtins = DEFAULT_CCR_RULES.map((def) => ({
    ...def,
    enabled: enabledByBuiltin.has(def.violationType)
      ? enabledByBuiltin.get(def.violationType)!
      : def.enabled,
  }));

  return [...builtins, ...customs];
}

export function rulesToMap(rules: CcrRule[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rules) {
    if (!r.enabled || !r.violationType.trim()) continue;
    const desc = r.description.trim() || r.violationType;
    if (r.custom) {
      map[r.violationType] = desc;
    } else {
      map[r.violationType] = `CC&R Section ${r.section}: ${desc}`;
    }
  }
  return map;
}

export function createCustomRule(input: {
  name: string;
  description: string;
  section?: string;
  enabled?: boolean;
}): CcrRule | null {
  const violationType = input.name.trim();
  const description = input.description.trim();
  if (!violationType || !description) return null;
  return {
    id: newCustomId(),
    violationType,
    section: (input.section ?? "Custom").trim() || "Custom",
    description,
    enabled: input.enabled !== false,
    custom: true,
  };
}

export const CCR_STORAGE_KEY = "pp-ccr-rules";

export function loadCcrRules(): CcrRule[] {
  if (typeof window === "undefined") return DEFAULT_CCR_RULES.map((r) => ({ ...r }));
  try {
    const raw = localStorage.getItem(CCR_STORAGE_KEY);
    if (!raw) return DEFAULT_CCR_RULES.map((r) => ({ ...r }));
    return normalizeCcrRules(JSON.parse(raw));
  } catch {
    return DEFAULT_CCR_RULES.map((r) => ({ ...r }));
  }
}

export function saveCcrRules(rules: CcrRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CCR_STORAGE_KEY, JSON.stringify(normalizeCcrRules(rules)));
}
