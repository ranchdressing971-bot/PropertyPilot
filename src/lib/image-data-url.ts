/** Normalize canvas/browser data URLs for OpenAI vision + storage. */

export function sanitizeImageDataUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Already a normal https URL (signed storage) — pass through
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (!trimmed.startsWith("data:image/")) return null;

  // Some browsers emit image/jpg — OpenAI expects image/jpeg
  let url = trimmed.replace(/^data:image\/jpg;/i, "data:image/jpeg;");

  // Allow optional params like charset=utf-8 before base64
  const match = url.match(
    /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) return null;

  const mime = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  const b64 = match[2].replace(/\s+/g, "");
  if (b64.length < 32) return null;

  return `data:image/${mime};base64,${b64}`;
}

/** Safe object key segment for Supabase Storage (no spaces/colons/etc). */
export function safeStorageSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "item";
}
