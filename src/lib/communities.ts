import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyContext, ensureCompanyForUser } from "@/lib/company";
import {
  isValidCommunityName,
  normalizeCommunityKey,
} from "@/lib/community-key";
import {
  getUserSubscription,
  hasActiveSubscription,
} from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import type { Property } from "@/lib/mock-data";

export interface Community {
  id: string;
  name: string;
  communityKey: string;
  companyId: string | null;
  userId: string;
  createdAt: string;
  propertyCount?: number;
  inspectionCount?: number;
}

export interface CommunityLimitStatus {
  currentCount: number;
  /** Max communities this account may hold (plan or trial). */
  limit: number;
  canCreate: boolean;
  subscribed: boolean;
  reason?: string;
  code?: string;
}

type DbClient =
  | NonNullable<Awaited<ReturnType<typeof createClient>>>
  | NonNullable<ReturnType<typeof createAdminClient>>;

function mapCommunity(row: {
  id: string;
  name: string;
  community_key: string;
  company_id?: string | null;
  user_id: string;
  created_at?: string;
}): Community {
  return {
    id: row.id,
    name: row.name,
    communityKey: row.community_key,
    companyId: row.company_id ?? null,
    userId: row.user_id,
    createdAt: row.created_at ?? "",
  };
}

function isMissingCommunitiesTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("communities"))
  );
}

async function dbClient(): Promise<DbClient | null> {
  const admin = createAdminClient();
  if (admin) return admin;
  return createClient();
}

/** How many communities this account may create. */
export async function getCommunityLimitStatus(
  userId: string
): Promise<CommunityLimitStatus> {
  const sub = await getUserSubscription(userId);
  const subscribed = hasActiveSubscription(sub.status);
  const currentCount = await countCommunitiesForUser(userId);

  // Without Stripe, allow a generous local/dev ceiling
  if (!isStripeConfigured()) {
    return {
      currentCount,
      limit: Math.max(sub.communityCount || 1, 10),
      canCreate: currentCount < Math.max(sub.communityCount || 1, 10),
      subscribed: true,
    };
  }

  if (subscribed) {
    const limit = Math.max(1, sub.communityCount || 1);
    return {
      currentCount,
      limit,
      canCreate: currentCount < limit,
      subscribed: true,
      reason:
        currentCount >= limit
          ? `Your plan includes ${limit} communit${limit === 1 ? "y" : "ies"}. Add more under Settings → Billing (or Pricing).`
          : undefined,
      code: currentCount >= limit ? "COMMUNITY_LIMIT" : undefined,
    };
  }

  // Trial / unpaid: one community
  const limit = 1;
  return {
    currentCount,
    limit,
    canCreate: currentCount < limit,
    subscribed: false,
    reason:
      currentCount >= limit
        ? "Your free trial includes 1 community. Subscribe to add more."
        : undefined,
    code: currentCount >= limit ? "COMMUNITY_LIMIT" : undefined,
  };
}

export async function countCommunitiesForUser(userId: string): Promise<number> {
  const client = await dbClient();
  if (!client) return 0;

  const ctx = await getActiveCompanyContext();
  try {
    if (ctx?.companyId) {
      const { count, error } = await client
        .from("communities")
        .select("*", { count: "exact", head: true })
        .eq("company_id", ctx.companyId);
      if (error) {
        if (isMissingCommunitiesTable(error)) return 0;
        console.error("countCommunitiesForUser:", error.message);
        return 0;
      }
      return count ?? 0;
    }

    const { count, error } = await client
      .from("communities")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) {
      if (isMissingCommunitiesTable(error)) return 0;
      console.error("countCommunitiesForUser:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error("countCommunitiesForUser crashed:", err);
    return 0;
  }
}

/**
 * Ensure a community exists for an explicit neighborhood / community name.
 * Does not fall back to the company name on the profile (communities are
 * created later by the user, not from company onboarding).
 */
export async function ensureDefaultCommunity(
  userId: string,
  communityName?: string | null
): Promise<Community | null> {
  const existing = await listCommunitiesForUser(userId);
  if (existing.length > 0) return existing[0];

  const name = (communityName ?? "").trim();
  if (!name || !isValidCommunityName(name)) return null;

  const created = await createCommunity(userId, name, { skipLimitCheck: true });
  if (!created.ok) return null;
  return created.community;
}

export async function listCommunitiesForUser(
  userId: string
): Promise<Community[]> {
  const client = await dbClient();
  if (!client) return [];

  const ctx = await getActiveCompanyContext();
  try {
    let query = client.from("communities").select("*").order("created_at", {
      ascending: true,
    });
    if (ctx?.companyId) {
      query = query.eq("company_id", ctx.companyId);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingCommunitiesTable(error)) return [];
      console.error("listCommunitiesForUser:", error.message);
      return [];
    }

    const communities = (data ?? []).map(mapCommunity);
    return attachCounts(client, communities, ctx?.companyId ?? null, userId);
  } catch (err) {
    console.error("listCommunitiesForUser crashed:", err);
    return [];
  }
}

async function attachCounts(
  client: DbClient,
  communities: Community[],
  companyId: string | null,
  userId: string
): Promise<Community[]> {
  if (communities.length === 0) return communities;

  try {
    let propQuery = client.from("properties").select("id, community_id, neighborhood");
    let inspQuery = client
      .from("inspections")
      .select("id, community_id, neighborhood");
    if (companyId) {
      propQuery = propQuery.eq("company_id", companyId);
      inspQuery = inspQuery.eq("company_id", companyId);
    } else {
      propQuery = propQuery.eq("user_id", userId);
      inspQuery = inspQuery.eq("user_id", userId);
    }

    const [{ data: props }, { data: inspections }] = await Promise.all([
      propQuery,
      inspQuery,
    ]);

    return communities.map((c) => {
      const propertyCount = (props ?? []).filter(
        (p) =>
          p.community_id === c.id ||
          (!p.community_id &&
            (p.neighborhood ?? "").trim().toLowerCase() === c.name.toLowerCase())
      ).length;
      const inspectionCount = (inspections ?? []).filter(
        (i) =>
          i.community_id === c.id ||
          (!i.community_id &&
            (i.neighborhood ?? "").trim().toLowerCase() === c.name.toLowerCase())
      ).length;
      return { ...c, propertyCount, inspectionCount };
    });
  } catch {
    return communities;
  }
}

export async function getCommunityById(
  userId: string,
  communityId: string
): Promise<Community | null> {
  const list = await listCommunitiesForUser(userId);
  return list.find((c) => c.id === communityId) ?? null;
}

export async function createCommunity(
  userId: string,
  name: string,
  opts?: { skipLimitCheck?: boolean }
): Promise<
  | { ok: true; community: Community; created: boolean }
  | { ok: false; error: string; code: string }
> {
  const trimmed = name.trim();
  if (!isValidCommunityName(trimmed)) {
    return {
      ok: false,
      error: "Enter a community name with at least a few letters (e.g. Willow Creek HOA).",
      code: "INVALID_COMMUNITY",
    };
  }

  const key = normalizeCommunityKey(trimmed);
  const client = await dbClient();
  if (!client) {
    return { ok: false, error: "Database not configured", code: "NO_DB" };
  }

  // Prefer existing company workspace. Only create a company when none exists;
  // never rename the company from a community name.
  let companyId: string | null = null;
  try {
    const ctx = await getActiveCompanyContext();
    companyId = ctx?.companyId ?? null;
    if (!companyId) {
      const ensured = await ensureCompanyForUser(userId, trimmed);
      companyId = ensured?.companyId ?? null;
    }
  } catch (err) {
    console.error("createCommunity ensureCompany:", err);
  }

  // Idempotent: same key already present
  const existing = await listCommunitiesForUser(userId);
  const match = existing.find((c) => c.communityKey === key);
  if (match) {
    // Refresh display name
    await client
      .from("communities")
      .update({ name: trimmed })
      .eq("id", match.id);
    return {
      ok: true,
      community: { ...match, name: trimmed },
      created: false,
    };
  }

  if (!opts?.skipLimitCheck) {
    const limit = await getCommunityLimitStatus(userId);
    if (!limit.canCreate) {
      return {
        ok: false,
        error: limit.reason ?? "Community limit reached.",
        code: limit.code ?? "COMMUNITY_LIMIT",
      };
    }
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    name: trimmed,
    community_key: key,
  };
  if (companyId) row.company_id = companyId;

  const { data, error } = await client
    .from("communities")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    if (isMissingCommunitiesTable(error)) {
      return {
        ok: false,
        error:
          "Communities table missing. Run docs/COMMUNITIES_SCHEMA.sql in Supabase.",
        code: "NO_SCHEMA",
      };
    }
    if (error?.code === "23505") {
      const again = await listCommunitiesForUser(userId);
      const found = again.find((c) => c.communityKey === key);
      if (found) return { ok: true, community: found, created: false };
    }
    console.error("createCommunity:", error?.message);
    return {
      ok: false,
      error: "Could not create community. Try again.",
      code: "CREATE_FAILED",
    };
  }

  // Keep community_key for trial / legacy paths; do not overwrite company name
  // stored in profiles.hoa_name.
  const priorCount = existing.length;
  if (priorCount === 0) {
    await client.from("profiles").upsert({
      id: userId,
      community_key: key,
      ...(companyId ? { active_company_id: companyId } : {}),
    });
  } else if (companyId) {
    await client.from("profiles").upsert({
      id: userId,
      active_company_id: companyId,
    });
  }

  return { ok: true, community: mapCommunity(data), created: true };
}

export async function loadPropertiesForCommunity(
  userId: string,
  community: Community
): Promise<Property[]> {
  const client = await dbClient();
  if (!client) return [];

  const ctx = await getActiveCompanyContext();
  let query = client.from("properties").select("*");
  if (ctx?.companyId) {
    query = query.eq("company_id", ctx.companyId);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("loadPropertiesForCommunity:", error.message);
    return [];
  }

  return data
    .filter(
      (row) =>
        row.community_id === community.id ||
        (!row.community_id &&
          (row.neighborhood ?? "").trim().toLowerCase() ===
            community.name.toLowerCase())
    )
    .map((row) => ({
      id: row.id,
      address: row.address,
      image: row.image ?? "",
      status: "Good Standing" as const,
      lastInspection: "·",
      neighborhood: row.neighborhood ?? community.name,
      communityId: row.community_id ?? community.id,
    }));
}

/**
 * Assign discovered inspection homes into a community roster.
 */
export async function assignPropertiesToCommunity(opts: {
  userId: string;
  communityId: string;
  properties: Array<{
    id: string;
    address: string;
    image?: string;
    neighborhood?: string;
  }>;
  inspectionId?: string;
}): Promise<
  | { ok: true; assigned: number }
  | { ok: false; error: string; code: string }
> {
  const community = await getCommunityById(opts.userId, opts.communityId);
  if (!community) {
    return { ok: false, error: "Community not found", code: "NOT_FOUND" };
  }

  const client = await dbClient();
  if (!client) {
    return { ok: false, error: "Database not configured", code: "NO_DB" };
  }

  const ctx = await getActiveCompanyContext();
  const companyId = community.companyId ?? ctx?.companyId ?? null;

  const rows = opts.properties.map((p) => {
    const row: Record<string, unknown> = {
      id: p.id,
      user_id: opts.userId,
      address: p.address,
      neighborhood: community.name,
      image: p.image ?? "",
      community_id: community.id,
      created_by: opts.userId,
    };
    if (companyId) row.company_id = companyId;
    return row;
  });

  if (rows.length > 0) {
    let { error } = await client.from("properties").upsert(rows);
    if (
      error?.message?.includes("community_id") ||
      error?.message?.includes("company_id")
    ) {
      const legacy = opts.properties.map((p) => ({
        id: p.id,
        user_id: opts.userId,
        address: p.address,
        neighborhood: community.name,
        image: p.image ?? "",
      }));
      ({ error } = await client.from("properties").upsert(legacy));
    }
    if (error) {
      console.error("assignPropertiesToCommunity:", error.message);
      return {
        ok: false,
        error: "Could not save properties to community.",
        code: "ASSIGN_FAILED",
      };
    }
  }

  if (opts.inspectionId) {
    const update: Record<string, unknown> = {
      community_id: community.id,
      neighborhood: community.name,
    };
    let q = client
      .from("inspections")
      .update(update)
      .eq("id", opts.inspectionId);
    if (companyId) q = q.eq("company_id", companyId);
    else q = q.eq("user_id", opts.userId);
    const { error } = await q;
    if (error?.message?.includes("community_id")) {
      await client
        .from("inspections")
        .update({ neighborhood: community.name })
        .eq("id", opts.inspectionId);
    }
  }

  return { ok: true, assigned: rows.length };
}
