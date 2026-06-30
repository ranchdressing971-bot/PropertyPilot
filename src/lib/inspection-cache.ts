import type { AIInspectionData } from "./ai-analyze";
import {
  formatInspectionForDisplay,
  type InspectionDisplayData,
} from "./inspection-display";
import type { Property, Violation } from "./mock-data";

const PREFIX = "pp-inspection-";
const INDEX_KEY = "pp-inspection-index";

/** Survives client-side navigation (upload → results) in the same tab. */
const memoryDisplay = new Map<string, InspectionDisplayData>();

function toDisplay(data: AIInspectionData): InspectionDisplayData {
  return formatInspectionForDisplay(data);
}

function readStorage(id: string): InspectionDisplayData | null {
  if (typeof window === "undefined") return null;

  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(`${PREFIX}${id}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as InspectionDisplayData | AIInspectionData;
      if (parsed.results?.[0] && "property" in parsed.results[0]) {
        return parsed as InspectionDisplayData;
      }
      return formatInspectionForDisplay(parsed as AIInspectionData);
    } catch {
      // try next store
    }
  }
  return null;
}

function writeStorage(display: InspectionDisplayData): void {
  if (typeof window === "undefined") return;

  const key = `${PREFIX}${display.id}`;
  const json = JSON.stringify(display);

  try {
    localStorage.setItem(key, json);
    const index = JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as string[];
    if (!index.includes(display.id)) {
      index.unshift(display.id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 50)));
    }
  } catch {
    // quota — still try session
  }

  try {
    sessionStorage.setItem(key, json);
  } catch {
    // ignore
  }
}

export function cacheInspectionClient(data: AIInspectionData): boolean {
  const display = toDisplay(data);
  memoryDisplay.set(display.id, display);
  writeStorage(display);
  return true;
}

export function getCachedInspectionClient(id: string): InspectionDisplayData | null {
  const mem = memoryDisplay.get(id);
  if (mem) return mem;
  const stored = readStorage(id);
  if (stored) memoryDisplay.set(id, stored);
  return stored;
}

export function listCachedInspectionIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function getPropertyFromCachedInspection(
  inspectionId: string,
  propertyId: string
): { property: Property; violation: Violation | null } | null {
  const inspection = getCachedInspectionClient(inspectionId);
  if (!inspection) return null;

  const result = inspection.results.find((r) => r.propertyId === propertyId);
  if (!result?.property) return null;

  return { property: result.property, violation: result.violation };
}
