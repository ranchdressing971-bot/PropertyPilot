import type { AIInspectionData } from "./ai-analyze";
import {
  formatInspectionForDisplay,
  type InspectionDisplayData,
} from "./inspection-display";

const PREFIX = "pp-inspection-";

/** Survives client-side navigation (upload → results) in the same tab. */
const memoryDisplay = new Map<string, InspectionDisplayData>();

function toDisplay(data: AIInspectionData): InspectionDisplayData {
  return formatInspectionForDisplay(data);
}

export function cacheInspectionClient(data: AIInspectionData): boolean {
  const display = toDisplay(data);
  memoryDisplay.set(display.id, display);

  if (typeof window === "undefined") return true;

  try {
    sessionStorage.setItem(`${PREFIX}${display.id}`, JSON.stringify(display));
    return true;
  } catch {
    return true;
  }
}

export function getCachedInspectionClient(id: string): InspectionDisplayData | null {
  const mem = memoryDisplay.get(id);
  if (mem) return mem;

  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(`${PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InspectionDisplayData | AIInspectionData;
    if (parsed.results?.[0] && "property" in parsed.results[0]) {
      return parsed as InspectionDisplayData;
    }
    return formatInspectionForDisplay(parsed as AIInspectionData);
  } catch {
    return null;
  }
}
