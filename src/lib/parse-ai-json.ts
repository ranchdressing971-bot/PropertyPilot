/**
 * Parse JSON from model responses without crashing the whole inspection.
 * Handles empty bodies and optional ```json fences.
 */

export function parseAiJson<T extends object>(
  text: string,
  fallback: T
): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!cleaned) return fallback;

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Common: trailing junk after a valid object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}
