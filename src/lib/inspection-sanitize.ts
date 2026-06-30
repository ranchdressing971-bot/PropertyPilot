import type { AIInspectionData } from "./ai-analyze";

/** Strip base64 blobs from any string field (DB + sessionStorage limits). */
export function stripDataUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return value.startsWith("data:") ? "" : value;
  }
  if (Array.isArray(value)) {
    return value.map(stripDataUrls);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = stripDataUrls(v);
    }
    return out;
  }
  return value;
}

/** Remove base64 frame blobs so DB + sessionStorage can store the inspection. */
export function stripInspectionForStorage(data: AIInspectionData): AIInspectionData {
  return stripDataUrls(data) as AIInspectionData;
}

export function inspectionPayloadBytes(data: AIInspectionData): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}
