import type { AIInspectionData } from "./ai-analyze";

const PREFIX = "pp-inspection-";

export function cacheInspectionClient(data: AIInspectionData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${PREFIX}${data.id}`, JSON.stringify(data));
  } catch {
    // Quota exceeded on large frame payloads — ignore
  }
}

export function getCachedInspectionClient(id: string): AIInspectionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AIInspectionData;
  } catch {
    return null;
  }
}
