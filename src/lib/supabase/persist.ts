import type { AIInspectionData } from "../ai-analyze";
import type { Property } from "../mock-data";
import { stripInspectionForStorage } from "../inspection-sanitize";
import { getActiveCompanyContext } from "../company";
import { createAdminClient } from "./admin";
import { createClient } from "./server";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type DbClient =
  | NonNullable<Awaited<ReturnType<typeof createClient>>>
  | ReturnType<typeof createAdminClient>;

async function resolveScope(userId: string): Promise<{
  userId: string;
  companyId: string | null;
}> {
  const ctx = await getActiveCompanyContext();
  if (ctx?.userId === userId) {
    return { userId, companyId: ctx.companyId };
  }
  return { userId, companyId: null };
}

export async function persistInspection(
  userId: string,
  inspection: AIInspectionData
): Promise<{ ok: boolean; error?: string }> {
  const lean = stripInspectionForStorage(inspection);
  const { companyId } = await resolveScope(userId);

  const baseRow: Record<string, unknown> = {
    id: lean.id,
    user_id: userId,
    name: lean.name,
    video_name: lean.videoName,
    neighborhood: lean.neighborhood,
    results: lean.results,
    violations: lean.violations,
    created_by: userId,
  };
  if (companyId) baseRow.company_id = companyId;

  const withMeta = {
    ...baseRow,
    metadata: {
      frameCount: lean.frameCount,
      addressMatches: lean.addressMatches,
      usedVideoFrames: lean.usedVideoFrames,
      usedGpsPipeline: lean.usedGpsPipeline,
      addressReviews: lean.addressReviews,
      propertyImages: lean.propertyImages ?? {},
      communityVerification: lean.communityVerification,
    },
  };

  async function tryUpsert(
    client: DbClient
  ): Promise<{ ok: boolean; error?: string }> {
    if (!client) return { ok: false, error: "No Supabase client" };

    let { error } = await client
      .from("inspections")
      .upsert(withMeta, { onConflict: "id" });

    if (error?.message?.includes("metadata")) {
      ({ error } = await client
        .from("inspections")
        .upsert(baseRow, { onConflict: "id" }));
    }

    if (error?.message?.includes("company_id") || error?.message?.includes("created_by")) {
      const legacy = {
        id: lean.id,
        user_id: userId,
        name: lean.name,
        video_name: lean.videoName,
        neighborhood: lean.neighborhood,
        results: lean.results,
        violations: lean.violations,
      };
      ({ error } = await client
        .from("inspections")
        .upsert(legacy, { onConflict: "id" }));
    }

    if (!error) return { ok: true };

    console.error("persistInspection failed:", error.message, error.code);
    return { ok: false, error: `${error.message}${error.code ? ` (${error.code})` : ""}` };
  }

  const supabase = await createClient();
  if (supabase) {
    const userAttempt = await tryUpsert(supabase);
    if (userAttempt.ok) return userAttempt;
    if (userAttempt.error?.includes("permission denied")) {
      return {
        ok: false,
        error:
          "Database permission denied. Run docs/FIX_SUPABASE.sql in Supabase SQL Editor.",
      };
    }
  }

  const admin = createAdminClient();
  if (admin) {
    const adminAttempt = await tryUpsert(admin);
    if (adminAttempt.ok) return adminAttempt;
    return adminAttempt;
  }

  return {
    ok: false,
    error:
      "Cannot save inspection. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars and sign in.",
  };
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
    usedGpsPipeline?: boolean;
    addressReviews?: AIInspectionData["addressReviews"];
    propertyImages?: Record<string, string>;
    communityVerification?: AIInspectionData["communityVerification"];
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
    usedGpsPipeline: meta.usedGpsPipeline,
    addressReviews: meta.addressReviews,
    propertyImages: meta.propertyImages,
    communityVerification: meta.communityVerification,
  };
}

async function fetchInspectionRow(
  userId: string,
  companyId: string | null,
  inspectionId: string,
  client: DbClient
) {
  if (!client) return null;
  let query = client.from("inspections").select("*").eq("id", inspectionId);
  if (companyId) {
    query = query.eq("company_id", companyId);
  } else {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function loadInspectionFromDbById(
  userId: string,
  inspectionId: string
): Promise<AIInspectionData | null> {
  const { companyId } = await resolveScope(userId);
  const supabase = await createClient();
  let row = supabase
    ? await fetchInspectionRow(userId, companyId, inspectionId, supabase)
    : null;

  if (!row) {
    const admin = createAdminClient();
    if (admin) {
      row = await fetchInspectionRow(userId, companyId, inspectionId, admin);
    }
  }

  if (!row) return null;
  return mapInspectionRow(row);
}

async function fetchInspectionRows(
  userId: string,
  companyId: string | null,
  client: DbClient
) {
  if (!client) return [];
  let query = client.from("inspections").select("*");
  if (companyId) {
    query = query.eq("company_id", companyId);
  } else {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("loadInspectionsFromDb failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function loadInspectionsFromDb(
  userId: string
): Promise<AIInspectionData[]> {
  const { companyId } = await resolveScope(userId);
  const admin = createAdminClient();
  let rows = admin ? await fetchInspectionRows(userId, companyId, admin) : [];

  if (rows.length === 0) {
    const supabase = await createClient();
    if (supabase) {
      rows = await fetchInspectionRows(userId, companyId, supabase);
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

  const { companyId } = await resolveScope(userId);

  const rows = properties.map((p) => {
    const row: Record<string, unknown> = {
      id: p.id,
      user_id: userId,
      address: p.address,
      neighborhood: p.neighborhood,
      image: p.image,
      created_by: userId,
    };
    if (companyId) row.company_id = companyId;
    return row;
  });

  let { error } = await supabase.from("properties").upsert(rows);
  if (error?.message?.includes("company_id") || error?.message?.includes("created_by")) {
    const legacy = properties.map((p) => ({
      id: p.id,
      user_id: userId,
      address: p.address,
      neighborhood: p.neighborhood,
      image: p.image,
    }));
    ({ error } = await supabase.from("properties").upsert(legacy));
  }

  if (error) {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("properties").upsert(rows);
    }
  }
}

export async function loadPropertiesFromDb(
  userId: string
): Promise<Property[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { companyId } = await resolveScope(userId);

  let query = supabase.from("properties").select("*");
  if (companyId) {
    query = query.eq("company_id", companyId);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("loadPropertiesFromDb:", error.message);
    // Fallback to user-scoped if company column missing / empty
    if (companyId) {
      const { data: fallback } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", userId);
      if (fallback) {
        return fallback.map((row) => ({
          id: row.id,
          address: row.address,
          image: row.image ?? "",
          status: "Good Standing" as const,
          lastInspection: "·",
          neighborhood: row.neighborhood ?? "",
        }));
      }
    }
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    address: row.address,
    image: row.image ?? "",
    status: "Good Standing" as const,
    lastInspection: "·",
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

  const { companyId } = await resolveScope(userId);
  const row: Record<string, unknown> = {
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  };
  if (companyId) row.company_id = companyId;

  const { error } = await supabase.from("audit_log").insert(row);
  if (error?.message?.includes("company_id")) {
    await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  }
}

export async function updateViolationInDb(
  userId: string,
  inspectionId: string,
  violationId: string,
  status: string
): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const { companyId } = await resolveScope(userId);
  let query = supabase
    .from("inspections")
    .select("violations")
    .eq("id", inspectionId);
  if (companyId) query = query.eq("company_id", companyId);
  else query = query.eq("user_id", userId);

  const { data } = await query.single();
  if (!data?.violations) return false;

  const violations = (data.violations as { id: string; status: string }[]).map(
    (v) => (v.id === violationId ? { ...v, status } : v)
  );

  let update = supabase
    .from("inspections")
    .update({ violations })
    .eq("id", inspectionId);
  if (companyId) update = update.eq("company_id", companyId);
  else update = update.eq("user_id", userId);

  await update;
  return true;
}
