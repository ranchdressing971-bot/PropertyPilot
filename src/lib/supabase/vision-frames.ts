import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { sanitizeImageDataUrl, safeStorageSegment } from "../image-data-url";

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const clean = sanitizeImageDataUrl(dataUrl);
  if (!clean || !clean.startsWith("data:")) return null;
  const match = clean.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64"),
  };
}

/**
 * Upload frame data-URLs to Supabase and return HTTPS signed URLs for OpenAI vision.
 * OpenAI often rejects large/malformed base64 data URLs with "did not follow the pattern".
 */
export async function uploadFramesForVision(
  userId: string,
  inspectionId: string,
  frames: { index: number; timestamp: number; dataUrl: string }[]
): Promise<{ index: number; timestamp: number; dataUrl: string }[]> {
  const admin = createAdminClient();
  const supabase = admin ?? (await createClient());
  if (!supabase) {
    // Fall back to sanitized data URLs if storage isn't available
    return frames
      .map((f) => {
        const dataUrl = sanitizeImageDataUrl(f.dataUrl);
        return dataUrl ? { ...f, dataUrl } : null;
      })
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
  }

  const bucket = "inspection-evidence";
  const out: { index: number; timestamp: number; dataUrl: string }[] = [];

  for (const frame of frames) {
    const parsed = parseDataUrl(frame.dataUrl);
    if (!parsed) continue;

    const ext = parsed.contentType.includes("png") ? "png" : "jpg";
    const path = `${safeStorageSegment(userId)}/${safeStorageSegment(inspectionId)}/vision-f${frame.index}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, parsed.buffer, {
      contentType: parsed.contentType.startsWith("image/")
        ? parsed.contentType
        : "image/jpeg",
      upsert: true,
    });

    if (error) {
      console.error("vision frame upload failed:", error.message);
      // Last resort: keep a cleaned data URL for this frame
      const fallback = sanitizeImageDataUrl(frame.dataUrl);
      if (fallback) out.push({ ...frame, dataUrl: fallback });
      continue;
    }

    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour — enough for analysis

    if (signError || !data?.signedUrl) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      if (pub?.publicUrl) {
        out.push({ ...frame, dataUrl: pub.publicUrl });
      }
      continue;
    }

    out.push({ ...frame, dataUrl: data.signedUrl });
  }

  return out;
}
