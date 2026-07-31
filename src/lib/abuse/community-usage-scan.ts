import { normalizeCommunityKey } from "@/lib/community-key";
import { createAdminClient } from "@/lib/supabase/admin";

export type AbuseSeverity = "low" | "medium" | "high";

export type CommunityAbuseFlag = {
  userId: string;
  email: string | null;
  hoaName: string | null;
  communityKey: string | null;
  subscriptionStatus: string;
  billedCommunities: number;
  estimatedCommunities: number;
  gap: number;
  score: number;
  severity: AbuseSeverity;
  signals: string[];
  neighborhoods: string[];
  zipClusters: string[];
  propertyCount: number;
  inspectionCount: number;
  priceMonthly: number | null;
};

export type CommunityAbuseReport = {
  scanned: number;
  flaggedCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  flagged: CommunityAbuseFlag[];
  plainEnglish: string;
};

const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;

function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.match(ZIP_RE);
  return m?.[1] ?? null;
}

function neighborhoodKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const key = normalizeCommunityKey(raw);
  return key.length >= 3 ? key : null;
}

function severityFor(gap: number, score: number): AbuseSeverity {
  if (gap >= 3 || score >= 70) return "high";
  if (gap >= 2 || score >= 45) return "medium";
  return "low";
}

/**
 * Lightweight abuse bot — no fingerprints.
 * Flags accounts billed for fewer communities than roster/inspection evidence suggests
 * (e.g. community_count=1 but many distinct neighborhoods / ZIP clusters).
 * Never blocks inspections; review-only for Nova / Isaac.
 */
export async function scanCommunityUsageAbuse(options?: {
  limit?: number;
}): Promise<CommunityAbuseReport> {
  const admin = createAdminClient();
  const empty: CommunityAbuseReport = {
    scanned: 0,
    flaggedCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    flagged: [],
    plainEnglish: "No admin DB — can't run community abuse scan.",
  };
  if (!admin) return empty;

  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);

  const [profilesRes, propertiesRes, inspectionsRes, companiesRes] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, email, hoa_name, community_key, community_count, subscription_status, price_monthly, active_company_id"
        )
        .limit(800),
      admin
        .from("properties")
        .select("user_id, neighborhood, address")
        .limit(10000),
      admin
        .from("inspections")
        .select("user_id, neighborhood")
        .limit(5000),
      admin.from("companies").select("id, hoa_name, community_key").limit(2000),
    ]);

  if (profilesRes.error) {
    console.error("abuse scan profiles:", profilesRes.error.message);
  }

  const profiles = (profilesRes.data ?? []) as Array<{
    id: string;
    email: string | null;
    hoa_name: string | null;
    community_key: string | null;
    community_count: number | null;
    subscription_status: string | null;
    price_monthly: number | null;
    active_company_id: string | null;
  }>;

  const companies = new Map(
    ((companiesRes.data ?? []) as Array<{
      id: string;
      hoa_name: string | null;
      community_key: string | null;
    }>).map((c) => [c.id, c])
  );

  type Bucket = {
    neighborhoods: Set<string>;
    zips: Set<string>;
    propertyCount: number;
    inspectionCount: number;
    inspNeighborhoods: Set<string>;
  };

  const byUser = new Map<string, Bucket>();
  const bucket = (userId: string): Bucket => {
    let b = byUser.get(userId);
    if (!b) {
      b = {
        neighborhoods: new Set(),
        zips: new Set(),
        propertyCount: 0,
        inspectionCount: 0,
        inspNeighborhoods: new Set(),
      };
      byUser.set(userId, b);
    }
    return b;
  };

  for (const row of (propertiesRes.data ?? []) as Array<{
    user_id: string;
    neighborhood: string | null;
    address: string | null;
  }>) {
    const b = bucket(row.user_id);
    b.propertyCount += 1;
    const nk = neighborhoodKey(row.neighborhood);
    if (nk) b.neighborhoods.add(nk);
    const zip = extractZip(row.address);
    if (zip) b.zips.add(zip);
  }

  for (const row of (inspectionsRes.data ?? []) as Array<{
    user_id: string;
    neighborhood: string | null;
  }>) {
    const b = bucket(row.user_id);
    b.inspectionCount += 1;
    const nk = neighborhoodKey(row.neighborhood);
    if (nk) b.inspNeighborhoods.add(nk);
  }

  const flagged: CommunityAbuseFlag[] = [];

  for (const p of profiles) {
    const status = (p.subscription_status ?? "none").toLowerCase();
    const billed = Math.max(1, Number(p.community_count) || 1);
    const data = byUser.get(p.id) ?? {
      neighborhoods: new Set<string>(),
      zips: new Set<string>(),
      propertyCount: 0,
      inspectionCount: 0,
      inspNeighborhoods: new Set<string>(),
    };

    const allHoods = new Set([
      ...data.neighborhoods,
      ...data.inspNeighborhoods,
    ]);
    const profileKey = p.community_key || neighborhoodKey(p.hoa_name);
    if (profileKey) allHoods.add(profileKey);

    const company = p.active_company_id
      ? companies.get(p.active_company_id)
      : null;
    const companyKey =
      company?.community_key || neighborhoodKey(company?.hoa_name ?? null);
    if (companyKey) allHoods.add(companyKey);

    const hoodCount = allHoods.size;
    const zipCount = data.zips.size;
    // ZIPs are a weaker signal — 2+ distinct ZIPs suggests multi-area use.
    const zipEstimate = zipCount >= 2 ? zipCount : 1;
    const estimated = Math.max(1, hoodCount, zipEstimate);

    if (estimated <= billed) continue;

    // Prefer catching paying / trial / past_due under-billing; still note free heavy users lightly.
    const isBilledSeat =
      status === "active" || status === "trialing" || status === "past_due";

    const gap = estimated - billed;
    const signals: string[] = [];
    let score = 0;

    if (hoodCount > billed) {
      signals.push(
        `${hoodCount} distinct neighborhoods/communities vs billed ${billed}`
      );
      score += Math.min(50, gap * 18);
    }
    if (zipCount >= 2 && zipCount > billed) {
      signals.push(`${zipCount} ZIP clusters on roster`);
      score += Math.min(25, (zipCount - billed) * 10);
    }
    if (data.propertyCount >= 150 && billed === 1) {
      signals.push(`large roster (${data.propertyCount} homes) on 1-community plan`);
      score += 15;
    }
    if (
      profileKey &&
      companyKey &&
      profileKey !== companyKey &&
      billed === 1
    ) {
      signals.push("profile HOA key ≠ company HOA key");
      score += 12;
    }
    if (isBilledSeat) score += 10;
    else {
      // Free accounts with multi-community evidence — lower priority
      score = Math.max(10, Math.floor(score * 0.55));
      signals.push("unpaid / inactive seat — monitor if they convert under-billed");
    }

    score = Math.min(100, score);
    if (score < 25 && !isBilledSeat) continue;

    const neighborhoods = [...allHoods].slice(0, 12);
    flagged.push({
      userId: p.id,
      email: p.email,
      hoaName: p.hoa_name,
      communityKey: p.community_key,
      subscriptionStatus: status,
      billedCommunities: billed,
      estimatedCommunities: estimated,
      gap,
      score,
      severity: severityFor(gap, score),
      signals,
      neighborhoods,
      zipClusters: [...data.zips].slice(0, 8),
      propertyCount: data.propertyCount,
      inspectionCount: data.inspectionCount,
      priceMonthly: p.price_monthly,
    });
  }

  flagged.sort((a, b) => b.score - a.score || b.gap - a.gap);
  const top = flagged.slice(0, limit);
  const highCount = top.filter((f) => f.severity === "high").length;
  const mediumCount = top.filter((f) => f.severity === "medium").length;
  const lowCount = top.filter((f) => f.severity === "low").length;

  return {
    scanned: profiles.length,
    flaggedCount: flagged.length,
    highCount,
    mediumCount,
    lowCount,
    flagged: top,
    plainEnglish:
      flagged.length === 0
        ? `Scanned ${profiles.length} profiles — no under-billed multi-community suspects.`
        : `Abuse bot: ${flagged.length} suspect(s) (${highCount} high). Top pattern: billed for fewer communities than roster/inspection neighborhoods show (e.g. paid for 1, evidence of ${top[0]?.estimatedCommunities ?? "?"}). Review only — never auto-block.`,
  };
}

/** Persist a short summary into audit_log for ops history (best-effort). */
export async function logAbuseScanSummary(
  report: CommunityAbuseReport
): Promise<void> {
  const admin = createAdminClient();
  if (!admin || report.flaggedCount === 0) return;

  for (const flag of report.flagged.slice(0, 15)) {
    try {
      await admin.from("audit_log").insert({
        user_id: flag.userId,
        action: "community_usage_suspected",
        entity_type: "profile",
        entity_id: flag.userId,
        metadata: {
          severity: flag.severity,
          score: flag.score,
          billedCommunities: flag.billedCommunities,
          estimatedCommunities: flag.estimatedCommunities,
          signals: flag.signals,
          neighborhoods: flag.neighborhoods,
          zipClusters: flag.zipClusters,
        },
      });
    } catch (e) {
      console.error("logAbuseScanSummary:", e);
    }
  }
}
