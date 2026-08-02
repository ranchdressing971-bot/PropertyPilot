import { scanCommunityUsageAbuse } from "@/lib/abuse/community-usage-scan";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_TRIAL_INSPECTIONS } from "@/lib/stripe";
import type { CommunityAbuseFlag } from "@/lib/abuse/community-usage-scan";

type ProfileRow = {
  id: string;
  email: string | null;
  hoa_name: string | null;
  subscription_status: string | null;
  plan: string | null;
  price_monthly: number | null;
  community_count: number | null;
  community_key: string | null;
  stripe_customer_id: string | null;
  onboarding_complete: boolean | null;
  terms_accepted_at: string | null;
  active_company_id: string | null;
  created_at: string | null;
};

type ClientCard = {
  id: string;
  email: string | null;
  hoaName: string | null;
  status: string;
  plan: string | null;
  priceMonthly: number | null;
  communityCount: number;
  inspections: number;
  properties: number;
  createdAt: string | null;
  daysToFirstInspection: number | null;
};

export type BusinessBrief = {
  revenue: {
    mrr: number;
    arr: number;
    pipelineMrr: number;
    byPlan: Record<string, number>;
    multiCommunityAccounts: number;
    multiCommunityMrr: number;
  };
  clients: {
    payingClients: number;
    trialingClients: number;
    pastDueClients: number;
    canceledClients: number;
    inactiveOrNone: number;
    totalProfiles: number;
    withStripeCustomer: number;
    onboardingComplete: number;
    termsAccepted: number;
  };
  /** Flat aliases so older status UI / prompts keep working. */
  mrr: number;
  arr: number;
  pipelineMrr: number;
  payingClients: number;
  trialingClients: number;
  pastDueClients: number;
  canceledClients: number;
  inactiveOrNone: number;
  totalProfiles: number;
  productCompanies: number;
  communityTrialsClaimed: number;
  inspectionsTotal: number;
  byPlan: Record<string, number>;
  activation: {
    inspectionsTotal: number;
    propertiesTotal: number;
    freeTrialLimit: number;
    payingWithZeroInspections: number;
    payingWithRoster: number;
    avgInspectionsPerPaying: number;
    medianDaysToFirstInspection: number | null;
    signupsLast7d: number;
    signupsLast30d: number;
    inspectionsLast7d: number;
    inspectionsLast30d: number;
    trialBurnedUnpaid: number;
  };
  teams: {
    productCompanies: number;
    activeMembers: number;
    multiSeatCompanies: number;
    invitesPending: number;
    invitesAccepted: number;
  };
  productUsage: {
    auditLast30d: Record<string, number>;
    violationApproved: number;
    violationDismissed: number;
    rosterImports: number;
    addressConfirms: number;
  };
  trials: {
    claimed: number;
    recent: Array<{
      hoaName: string;
      claimedAt: string | null;
      claimedBy: string | null;
      converted: boolean;
    }>;
    claimedConverted: number;
    claimedStillUnpaid: number;
  };
  trust: {
    /** Abuse bot — under-billed multi-community suspects (not fingerprints). */
    abuseFlagged: number;
    abuseHigh: number;
    abuseMedium: number;
    abuseLow: number;
    abusePlainEnglish: string;
    topSuspects: CommunityAbuseFlag[];
  };
  watchlists: {
    pastDue: ClientCard[];
    canceled: ClientCard[];
    deadPaid: ClientCard[];
    trialBurnedUnpaid: ClientCard[];
    highValue: ClientCard[];
    underBilledCommunities: CommunityAbuseFlag[];
  };
  recentClients: ClientCard[];
  plainEnglish: string;
};

const EMPTY: BusinessBrief = {
  revenue: {
    mrr: 0,
    arr: 0,
    pipelineMrr: 0,
    byPlan: {},
    multiCommunityAccounts: 0,
    multiCommunityMrr: 0,
  },
  clients: {
    payingClients: 0,
    trialingClients: 0,
    pastDueClients: 0,
    canceledClients: 0,
    inactiveOrNone: 0,
    totalProfiles: 0,
    withStripeCustomer: 0,
    onboardingComplete: 0,
    termsAccepted: 0,
  },
  mrr: 0,
  arr: 0,
  pipelineMrr: 0,
  payingClients: 0,
  trialingClients: 0,
  pastDueClients: 0,
  canceledClients: 0,
  inactiveOrNone: 0,
  totalProfiles: 0,
  productCompanies: 0,
  communityTrialsClaimed: 0,
  inspectionsTotal: 0,
  byPlan: {},
  activation: {
    inspectionsTotal: 0,
    propertiesTotal: 0,
    freeTrialLimit: FREE_TRIAL_INSPECTIONS,
    payingWithZeroInspections: 0,
    payingWithRoster: 0,
    avgInspectionsPerPaying: 0,
    medianDaysToFirstInspection: null,
    signupsLast7d: 0,
    signupsLast30d: 0,
    inspectionsLast7d: 0,
    inspectionsLast30d: 0,
    trialBurnedUnpaid: 0,
  },
  teams: {
    productCompanies: 0,
    activeMembers: 0,
    multiSeatCompanies: 0,
    invitesPending: 0,
    invitesAccepted: 0,
  },
  productUsage: {
    auditLast30d: {},
    violationApproved: 0,
    violationDismissed: 0,
    rosterImports: 0,
    addressConfirms: 0,
  },
  trials: {
    claimed: 0,
    recent: [],
    claimedConverted: 0,
    claimedStillUnpaid: 0,
  },
  trust: {
    abuseFlagged: 0,
    abuseHigh: 0,
    abuseMedium: 0,
    abuseLow: 0,
    abusePlainEnglish: "Abuse bot not run.",
    topSuspects: [],
  },
  watchlists: {
    pastDue: [],
    canceled: [],
    deadPaid: [],
    trialBurnedUnpaid: [],
    highValue: [],
    underBilledCommunities: [],
  },
  recentClients: [],
  plainEnglish: "No admin DB — can't read RideBy business metrics.",
};

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function statusOf(p: ProfileRow): string {
  return (p.subscription_status ?? "none").toLowerCase();
}

function isPayingOrTrial(status: string): boolean {
  return status === "active" || status === "trialing";
}

async function safeSelect<T>(
  label: string,
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      console.error(`loadBusinessBrief ${label}:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error(`loadBusinessBrief ${label}:`, e);
    return [];
  }
}

async function safeCount(
  label: string,
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  try {
    const { count, error } = await run();
    if (error) {
      console.error(`loadBusinessBrief ${label}:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.error(`loadBusinessBrief ${label}:`, e);
    return 0;
  }
}

/**
 * Full RideBy fleet intelligence for Nova (revenue, activation, churn, teams, trust).
 * Service role only — Nexus/Nova admin paths.
 * Outbound Places cold-lead runway (finite HOA management TAM) lives on status, not here.
 */
export async function loadBusinessBrief(): Promise<BusinessBrief> {
  const admin = createAdminClient();
  if (!admin) return { ...EMPTY, plainEnglish: EMPTY.plainEnglish };

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    profiles,
    inspections,
    properties,
    members,
    invites,
    trials,
    audits,
    productCompanies,
    inspectionsExact,
    propertiesExact,
    abuseReport,
  ] = await Promise.all([
    safeSelect<ProfileRow>("profiles", () =>
      admin
        .from("profiles")
        .select(
          "id, email, hoa_name, subscription_status, plan, price_monthly, community_count, community_key, stripe_customer_id, onboarding_complete, terms_accepted_at, active_company_id, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(800)
    ),
    safeSelect<{
      id: string;
      user_id: string;
      company_id: string | null;
      created_at: string | null;
    }>("inspections", () =>
      admin
        .from("inspections")
        .select("id, user_id, company_id, created_at")
        .order("created_at", { ascending: false })
        .limit(3000)
    ),
    safeSelect<{ user_id: string; company_id: string | null }>("properties", () =>
      admin.from("properties").select("user_id, company_id").limit(8000)
    ),
    safeSelect<{
      company_id: string;
      user_id: string;
      role: string;
      status: string;
    }>("company_members", () =>
      admin
        .from("company_members")
        .select("company_id, user_id, role, status")
        .eq("status", "active")
        .limit(2000)
    ),
    safeSelect<{
      accepted_at: string | null;
      expires_at: string | null;
    }>("company_invites", () =>
      admin
        .from("company_invites")
        .select("accepted_at, expires_at")
        .limit(2000)
    ),
    safeSelect<{
      community_key: string;
      claimed_by: string | null;
      hoa_name: string;
      claimed_at: string | null;
    }>("community_trials", () =>
      admin
        .from("community_trials")
        .select("community_key, claimed_by, hoa_name, claimed_at")
        .order("claimed_at", { ascending: false })
        .limit(200)
    ),
    safeSelect<{ action: string; created_at: string | null }>("audit_log", () =>
      admin
        .from("audit_log")
        .select("action, created_at")
        .gte("created_at", since30)
        .limit(4000)
    ),
    safeCount("companies", () =>
      admin.from("companies").select("id", { count: "exact", head: true })
    ),
    safeCount("inspections_exact", () =>
      admin.from("inspections").select("id", { count: "exact", head: true })
    ),
    safeCount("properties_exact", () =>
      admin.from("properties").select("id", { count: "exact", head: true })
    ),
    scanCommunityUsageAbuse({ limit: 20 }),
  ]);

  const inspByUser = new Map<string, { count: number; firstAt: string | null }>();
  let inspectionsLast7d = 0;
  let inspectionsLast30d = 0;
  for (const row of inspections) {
    const cur = inspByUser.get(row.user_id) ?? { count: 0, firstAt: null };
    cur.count += 1;
    if (
      !cur.firstAt ||
      (row.created_at && row.created_at < cur.firstAt)
    ) {
      cur.firstAt = row.created_at;
    }
    inspByUser.set(row.user_id, cur);
    if (row.created_at && row.created_at >= since7) inspectionsLast7d += 1;
    if (row.created_at && row.created_at >= since30) inspectionsLast30d += 1;
  }

  const propsByUser = new Map<string, number>();
  for (const row of properties) {
    propsByUser.set(row.user_id, (propsByUser.get(row.user_id) ?? 0) + 1);
  }

  const byPlan: Record<string, number> = {};
  let activeMrr = 0;
  let trialMrr = 0;
  let payingClients = 0;
  let trialingClients = 0;
  let pastDueClients = 0;
  let canceledClients = 0;
  let inactiveOrNone = 0;
  let withStripeCustomer = 0;
  let onboardingComplete = 0;
  let termsAccepted = 0;
  let multiCommunityAccounts = 0;
  let multiCommunityMrr = 0;
  let signupsLast7d = 0;
  let signupsLast30d = 0;

  const latencyDays: number[] = [];
  let payingInspSum = 0;
  let payingWithZeroInspections = 0;
  let payingWithRoster = 0;

  const pastDueList: ClientCard[] = [];
  const canceledList: ClientCard[] = [];
  const deadPaid: ClientCard[] = [];
  const trialBurned: ClientCard[] = [];
  const highValue: ClientCard[] = [];
  const recentPaying: ClientCard[] = [];

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  for (const p of profiles) {
    const status = statusOf(p);
    const plan = (p.plan ?? "unknown").toLowerCase();
    const price = Number(p.price_monthly) || 0;
    const communities = Number(p.community_count) || 1;
    const insp = inspByUser.get(p.id)?.count ?? 0;
    const props = propsByUser.get(p.id) ?? 0;
    const firstInsp = inspByUser.get(p.id)?.firstAt ?? null;
    const daysToFirst = daysBetween(p.created_at, firstInsp);

    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    if (p.stripe_customer_id) withStripeCustomer += 1;
    if (p.onboarding_complete) onboardingComplete += 1;
    if (p.terms_accepted_at) termsAccepted += 1;
    if (p.created_at && p.created_at >= since7) signupsLast7d += 1;
    if (p.created_at && p.created_at >= since30) signupsLast30d += 1;

    const card: ClientCard = {
      id: p.id,
      email: p.email,
      hoaName: p.hoa_name,
      status,
      plan: p.plan,
      priceMonthly: p.price_monthly,
      communityCount: communities,
      inspections: insp,
      properties: props,
      createdAt: p.created_at,
      daysToFirstInspection: daysToFirst,
    };

    if (status === "active") {
      payingClients += 1;
      activeMrr += price;
      payingInspSum += insp;
      if (insp === 0) {
        payingWithZeroInspections += 1;
        deadPaid.push(card);
      }
      if (props > 0) payingWithRoster += 1;
      if (daysToFirst != null) latencyDays.push(daysToFirst);
      if (communities > 1) {
        multiCommunityAccounts += 1;
        multiCommunityMrr += price;
      }
      if (price >= 50 || communities > 1 || insp >= 5) highValue.push(card);
      recentPaying.push(card);
    } else if (status === "trialing") {
      trialingClients += 1;
      trialMrr += price;
      recentPaying.push(card);
    } else if (status === "past_due") {
      pastDueClients += 1;
      pastDueList.push(card);
    } else if (status === "canceled") {
      canceledClients += 1;
      canceledList.push(card);
    } else {
      inactiveOrNone += 1;
      if (insp >= FREE_TRIAL_INSPECTIONS) trialBurned.push(card);
    }
  }

  recentPaying.sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
  highValue.sort(
    (a, b) =>
      (b.priceMonthly ?? 0) - (a.priceMonthly ?? 0) ||
      b.inspections - a.inspections
  );

  const membersByCompany = new Map<string, number>();
  for (const m of members) {
    membersByCompany.set(
      m.company_id,
      (membersByCompany.get(m.company_id) ?? 0) + 1
    );
  }
  let multiSeatCompanies = 0;
  for (const n of membersByCompany.values()) {
    if (n > 1) multiSeatCompanies += 1;
  }
  const invitesAccepted = invites.filter((i) => i.accepted_at).length;
  const invitesPending = invites.filter(
    (i) => !i.accepted_at && (!i.expires_at || i.expires_at > new Date().toISOString())
  ).length;

  const auditLast30d: Record<string, number> = {};
  for (const a of audits) {
    const key = a.action || "unknown";
    auditLast30d[key] = (auditLast30d[key] ?? 0) + 1;
  }

  let claimedConverted = 0;
  let claimedStillUnpaid = 0;
  for (const t of trials) {
    const claimant = t.claimed_by ? profileById.get(t.claimed_by) : null;
    if (claimant && isPayingOrTrial(statusOf(claimant))) claimedConverted += 1;
    else claimedStillUnpaid += 1;
  }
  const recentTrials = trials.slice(0, 15).map((t) => {
    const claimant = t.claimed_by ? profileById.get(t.claimed_by) : null;
    return {
      hoaName: t.hoa_name,
      claimedAt: t.claimed_at,
      claimedBy: t.claimed_by,
      converted: Boolean(
        claimant && isPayingOrTrial(statusOf(claimant))
      ),
    };
  });

  const pipelineMrr = activeMrr + trialMrr;
  const avgInspectionsPerPaying =
    payingClients > 0
      ? Math.round((payingInspSum / payingClients) * 10) / 10
      : 0;

  const plainEnglish = [
    `MRR $${activeMrr}/mo (ARR $${activeMrr * 12}); pipeline $${pipelineMrr} if trials convert.`,
    `${payingClients} active, ${trialingClients} trialing, ${pastDueClients} past due, ${canceledClients} canceled.`,
    `${payingWithZeroInspections} paid with zero inspections (dead).`,
    `${signupsLast7d} signups / ${inspectionsLast7d} inspections in 7d.`,
    `Trials claimed ${trials.length} (${claimedConverted} converted in snapshot).`,
    `Teams: ${productCompanies} companies, ${multiSeatCompanies} multi-seat, ${invitesPending} invites pending.`,
    abuseReport.flaggedCount > 0
      ? `Abuse bot: ${abuseReport.flaggedCount} under-billed multi-community suspect(s) (${abuseReport.highCount} high).`
      : "Abuse bot: no under-billed multi-community suspects.",
  ].join(" ");

  const inspectionsTotal = inspectionsExact || inspections.length;
  const propertiesTotal = propertiesExact || properties.length;

  return {
    revenue: {
      mrr: activeMrr,
      arr: activeMrr * 12,
      pipelineMrr,
      byPlan,
      multiCommunityAccounts,
      multiCommunityMrr,
    },
    clients: {
      payingClients,
      trialingClients,
      pastDueClients,
      canceledClients,
      inactiveOrNone,
      totalProfiles: profiles.length,
      withStripeCustomer,
      onboardingComplete,
      termsAccepted,
    },
    mrr: activeMrr,
    arr: activeMrr * 12,
    pipelineMrr,
    payingClients,
    trialingClients,
    pastDueClients,
    canceledClients,
    inactiveOrNone,
    totalProfiles: profiles.length,
    productCompanies,
    communityTrialsClaimed: trials.length,
    inspectionsTotal,
    byPlan,
    activation: {
      inspectionsTotal,
      propertiesTotal,
      freeTrialLimit: FREE_TRIAL_INSPECTIONS,
      payingWithZeroInspections,
      payingWithRoster,
      avgInspectionsPerPaying,
      medianDaysToFirstInspection: median(latencyDays),
      signupsLast7d,
      signupsLast30d,
      inspectionsLast7d,
      inspectionsLast30d,
      trialBurnedUnpaid: trialBurned.length,
    },
    teams: {
      productCompanies,
      activeMembers: members.length,
      multiSeatCompanies,
      invitesPending,
      invitesAccepted,
    },
    productUsage: {
      auditLast30d,
      violationApproved: auditLast30d.violation_approved ?? 0,
      violationDismissed: auditLast30d.violation_dismissed ?? 0,
      rosterImports: auditLast30d.roster_import ?? 0,
      addressConfirms: auditLast30d.address_confirm ?? 0,
    },
    trials: {
      claimed: trials.length,
      recent: recentTrials,
      claimedConverted,
      claimedStillUnpaid,
    },
    trust: {
      abuseFlagged: abuseReport.flaggedCount,
      abuseHigh: abuseReport.highCount,
      abuseMedium: abuseReport.mediumCount,
      abuseLow: abuseReport.lowCount,
      abusePlainEnglish: abuseReport.plainEnglish,
      topSuspects: abuseReport.flagged.slice(0, 8),
    },
    watchlists: {
      pastDue: pastDueList.slice(0, 15),
      canceled: canceledList.slice(0, 15),
      deadPaid: deadPaid.slice(0, 15),
      trialBurnedUnpaid: trialBurned.slice(0, 15),
      highValue: highValue.slice(0, 15),
      underBilledCommunities: abuseReport.flagged.slice(0, 15),
    },
    recentClients: recentPaying.slice(0, 15),
    plainEnglish,
  };
}
