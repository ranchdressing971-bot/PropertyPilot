import type { AIInspectionData } from "../ai-analyze";
import type { Property } from "../mock-data";
import { stripInspectionForStorage } from "../inspection-sanitize";
import { createAdminClient } from "./admin";
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
): Promise<boolean> {
  const lean = stripInspectionForStorage(inspection);

  const baseRow = {
    id: lean.id,
    user_id: userId,
    name: lean.name,
    video_name: lean.videoName,
    neighborhood: lean.neighborhood,
    results: lean.results,
    violations: lean.violations,
  };

  const withMeta = {
    ...baseRow,
    metadata: {
      frameCount: lean.frameCount,
      addressMatches: lean.addressMatches,
      usedVideoFrames: lean.usedVideoFrames,
      propertyImages: lean.propertyImages ?? {},
    },
  };

  async function tryUpsert(
    client: NonNullable<Awaited<ReturnType<typeof createClient>>> | ReturnType<typeof createAdminClient>
  ): Promise<boolean> {
    if (!client) return false;
    let { error } = await client.from("inspections").upsert(withMeta);
    if (error?.message?.includes("metadata")) {
      ({ error } = await client.from("inspections").upsert(baseRow));
    }
    if (!error) return true;
    console.error("persistInspection failed:", error.message);
    return false;
  }

  const admin = createAdminClient();
  if (admin && (await tryUpsert(admin))) return true;

  const supabase = await createClient();
  if (supabase && (await tryUpsert(supabase))) return true;

  return false;
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
    propertyImages?: Record<string, string>;
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
    propertyImages: meta.propertyImages,
  };
}

async function fetchInspectionRow(
  userId: string,
  inspectionId: string,
  client: NonNullable<Awaited<ReturnType<typeof createClient>>> | ReturnType<typeof createAdminClient>
) {
  if (!client) return null;
  const { data, error } = await client
    .from("inspections")
    .select("*")
    .eq("user_id", userId)
    .eq("id", inspectionId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function loadInspectionFromDbById(
  userId: string,
  inspectionId: string
): Promise<AIInspectionData | null> {
  const supabase = await createClient();
  let row = supabase
    ? await fetchInspectionRow(userId, inspectionId, supabase)
    : null;

  if (!row) {
    const admin = createAdminClient();
    if (admin) {
      row = await fetchInspectionRow(userId, inspectionId, admin);
    }
  }

  if (!row) return null;
  return mapInspectionRow(row);
}

async function fetchInspectionRows(
  userId: string,
  client: NonNullable<Awaited<ReturnType<typeof createClient>>> | ReturnType<typeof createAdminClient>
) {
  if (!client) return [];
  const { data, error } = await client
    .from("inspections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadInspectionsFromDb failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function loadInspectionsFromDb(
  userId: string
): Promise<AIInspectionData[]> {
  const supabase = await createClient();
  let rows = supabase ? await fetchInspectionRows(userId, supabase) : [];

  if (rows.length === 0) {
    const admin = createAdminClient();
    if (admin) {
      rows = await fetchInspectionRows(userId, admin);
    }
  }

  return rows.map((row) => mapInspectionRow(row));
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
