import { createAdminClient } from "@/lib/supabase/admin";

export type BusinessBrief = {
  mrr: number;
  arr: number;
  /** Expected MRR if all trials convert at listed price_monthly. */
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
  recentClients: Array<{
    email: string | null;
    hoaName: string | null;
    status: string;
    plan: string | null;
    priceMonthly: number | null;
    createdAt: string | null;
  }>;
  plainEnglish: string;
};

const EMPTY: BusinessBrief = {
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
  recentClients: [],
  plainEnglish: "No admin DB — can't read RideBy business metrics.",
};

function isPaying(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Fleet-level RideBy business snapshot for Nova (MRR, clients, product usage).
 * Uses service role — Nexus/Nova admin only.
 */
export async function loadBusinessBrief(): Promise<BusinessBrief> {
  const admin = createAdminClient();
  if (!admin) return { ...EMPTY };

  const [profilesRes, companiesRes, trialsRes, inspectionsRes] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "email, hoa_name, subscription_status, plan, price_monthly, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin
        .from("community_trials")
        .select("id", { count: "exact", head: true }),
      admin.from("inspections").select("id", { count: "exact", head: true }),
    ]);

  if (profilesRes.error) {
    console.error("loadBusinessBrief profiles:", profilesRes.error.message);
  }

  const profiles = (profilesRes.data ?? []) as Array<{
    email: string | null;
    hoa_name: string | null;
    subscription_status: string | null;
    plan: string | null;
    price_monthly: number | null;
    created_at: string | null;
  }>;

  let activeMrr = 0;
  let trialMrr = 0;
  let payingClients = 0;
  let trialingClients = 0;
  let pastDueClients = 0;
  let canceledClients = 0;
  let inactiveOrNone = 0;
  const byPlan: Record<string, number> = {};

  for (const p of profiles) {
    const status = (p.subscription_status ?? "none").toLowerCase();
    const plan = (p.plan ?? "unknown").toLowerCase();
    const price = Number(p.price_monthly) || 0;
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;

    if (status === "active") {
      payingClients += 1;
      activeMrr += price;
    } else if (status === "trialing") {
      trialingClients += 1;
      trialMrr += price;
    } else if (status === "past_due") {
      pastDueClients += 1;
    } else if (status === "canceled") {
      canceledClients += 1;
    } else {
      inactiveOrNone += 1;
    }
  }

  const pipelineMrr = activeMrr + trialMrr;
  const recentClients = profiles
    .filter((p) => isPaying(p.subscription_status))
    .slice(0, 12)
    .map((p) => ({
      email: p.email,
      hoaName: p.hoa_name,
      status: p.subscription_status ?? "none",
      plan: p.plan,
      priceMonthly: p.price_monthly,
      createdAt: p.created_at,
    }));

  const productCompanies = companiesRes.count ?? 0;
  const communityTrialsClaimed = trialsRes.count ?? 0;
  const inspectionsTotal = inspectionsRes.count ?? 0;

  return {
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
    communityTrialsClaimed,
    inspectionsTotal,
    byPlan,
    recentClients,
    plainEnglish: `MRR $${activeMrr}/mo (ARR $${activeMrr * 12}). Pipeline MRR $${pipelineMrr} if trials convert. ${payingClients} active, ${trialingClients} trialing, ${pastDueClients} past due. ${productCompanies} product companies, ${inspectionsTotal} inspections, ${communityTrialsClaimed} community trials. ${profiles.length} profiles in snapshot.`,
  };
}
