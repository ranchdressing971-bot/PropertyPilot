import type { AIInspectionData } from "../ai-analyze";
import type { Property } from "../mock-data";
import { createClient } from "./server";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function persistInspection(
  userId: string,
  inspection: AIInspectionData
): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  const { error } = await supabase.from("inspections").upsert({
    id: inspection.id,
    user_id: userId,
    name: inspection.name,
    video_name: inspection.videoName,
    neighborhood: inspection.neighborhood,
    results: inspection.results,
    violations: inspection.violations,
    metadata: {
      frameCount: inspection.frameCount,
      addressMatches: inspection.addressMatches,
      usedVideoFrames: inspection.usedVideoFrames,
    },
  });

  if (error) {
    console.error("persistInspection failed:", error.message);
  }
}

function mapInspectionRow(row: {
  id: string;
  name: string;
  created_at?: string;
  video_name?: string;
  neighborhood?: string;
  results?: AIInspectionData["results"];
  violations?: AIInspectionData["violations"];
  metadata?: {
    frameCount?: number;
    addressMatches?: number;
    usedVideoFrames?: boolean;
  } | null;
}): AIInspectionData {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    name: row.name,
    date: row.created_at?.split("T")[0] ?? "",
    videoName: row.video_name ?? "",
    neighborhood: row.neighborhood ?? "",
    aiPowered: true,
    results: row.results ?? [],
    violations: row.violations ?? [],
    frameCount: meta.frameCount,
    addressMatches: meta.addressMatches,
    usedVideoFrames: meta.usedVideoFrames,
  };
}

export async function loadInspectionFromDbById(
  userId: string,
  inspectionId: string
): Promise<AIInspectionData | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("inspections")
    .select("*")
    .eq("user_id", userId)
    .eq("id", inspectionId)
    .maybeSingle();

  if (error || !data) return null;
  return mapInspectionRow(data);
}

export async function loadInspectionsFromDb(
  userId: string
): Promise<AIInspectionData[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("inspections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row) => mapInspectionRow(row));
}

export async function persistProperties(
  userId: string,
  properties: Property[]
): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  const rows = properties.map((p) => ({
    id: p.id,
    user_id: userId,
    address: p.address,
    neighborhood: p.neighborhood,
    image: p.image,
  }));

  await supabase.from("properties").upsert(rows);
}

export async function loadPropertiesFromDb(
  userId: string
): Promise<Property[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId);

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    address: row.address,
    image: row.image ?? "",
    status: "Good Standing" as const,
    lastInspection: "—",
    neighborhood: row.neighborhood ?? "",
  }));
}

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  await supabase.from("audit_log").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

export async function updateViolationInDb(
  userId: string,
  inspectionId: string,
  violationId: string,
  status: string
): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("inspections")
    .select("violations")
    .eq("user_id", userId)
    .eq("id", inspectionId)
    .single();

  if (!data?.violations) return false;

  const violations = (data.violations as { id: string; status: string }[]).map(
    (v) => (v.id === violationId ? { ...v, status } : v)
  );

  await supabase
    .from("inspections")
    .update({ violations })
    .eq("user_id", userId)
    .eq("id", inspectionId);

  return true;
}
