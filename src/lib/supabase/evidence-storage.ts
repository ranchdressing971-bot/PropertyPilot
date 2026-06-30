import type { Violation } from "../mock-data";
import { createAdminClient } from "./admin";
import { createClient } from "./server";

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

/** Upload frame evidence to Supabase Storage; replace data: URLs with public HTTPS URLs. */
export async function persistEvidenceImages(
  userId: string,
  inspectionId: string,
  violations: Violation[]
): Promise<Violation[]> {
  const admin = createAdminClient();
  const supabase = admin ?? (await createClient());
  if (!supabase) return violations;

  const bucket = "inspection-evidence";

  return Promise.all(
    violations.map(async (violation) => {
      const evidenceImages = await Promise.all(
        violation.evidenceImages.map(async (img, index) => {
          if (!img.startsWith("data:")) return img;

          const parsed = parseDataUrl(img);
          if (!parsed) return "";

          const ext = parsed.contentType.includes("png") ? "png" : "jpg";
          const path = `${userId}/${inspectionId}/${violation.propertyId}-${index}.${ext}`;

          const { error } = await supabase.storage.from(bucket).upload(path, parsed.buffer, {
            contentType: parsed.contentType,
            upsert: true,
          });

          if (error) {
            console.error("evidence upload failed:", error.message);
            return "";
          }

          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          return data.publicUrl;
        })
      );

      return {
        ...violation,
        evidenceImages: evidenceImages.filter(Boolean),
      };
    })
  );
}

/** Upload per-property frame thumbnails for the results grid. */
export async function persistPropertyThumbnails(
  userId: string,
  inspectionId: string,
  properties: { id: string; image?: string }[]
): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const supabase = admin ?? (await createClient());
  if (!supabase) return {};

  const bucket = "inspection-evidence";
  const urls: Record<string, string> = {};

  await Promise.all(
    properties.map(async (property) => {
      const img = property.image;
      if (!img?.startsWith("data:")) {
        if (img) urls[property.id] = img;
        return;
      }

      const parsed = parseDataUrl(img);
      if (!parsed) return;

      const ext = parsed.contentType.includes("png") ? "png" : "jpg";
      const path = `${userId}/${inspectionId}/thumb-${property.id}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: true,
      });

      if (error) {
        console.error("thumbnail upload failed:", error.message);
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      urls[property.id] = data.publicUrl;
    })
  );

  return urls;
}
