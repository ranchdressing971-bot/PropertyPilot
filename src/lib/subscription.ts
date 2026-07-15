import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_TRIAL_INSPECTIONS, isStripeConfigured } from "@/lib/stripe";
import {
  isValidCommunityName,
  normalizeCommunityKey,
} from "@/lib/community-key";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive"
  | "none";

export interface UserSubscription {
  status: SubscriptionStatus;
  plan: string | null;
  stripeCustomerId: string | null;
  hoaName: string | null;
  communityKey: string | null;
  communityCount: number;
  priceMonthly: number | null;
}

export async function countCompletedInspections(userId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { count } = await admin
    .from("inspections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      status: "none",
      plan: null,
      stripeCustomerId: null,
      hoaName: null,
      communityKey: null,
      communityCount: 1,
      priceMonthly: null,
    };
  }

  const { data } = await admin
    .from("profiles")
    .select(
      "subscription_status, plan, stripe_customer_id, hoa_name, community_key, community_count, price_monthly"
    )
    .eq("id", userId)
    .maybeSingle();

  if (!data) {
    return {
      status: "none",
      plan: null,
      stripeCustomerId: null,
      hoaName: null,
      communityKey: null,
      communityCount: 1,
      priceMonthly: null,
    };
  }

  return {
    status: (data.subscription_status as SubscriptionStatus) ?? "none",
    plan: data.plan ?? null,
    stripeCustomerId: data.stripe_customer_id ?? null,
    hoaName: data.hoa_name ?? null,
    communityKey: data.community_key ?? null,
    communityCount: Math.max(1, Number(data.community_count) || 1),
    priceMonthly:
      data.price_monthly != null ? Number(data.price_monthly) : null,
  };
}

export function hasActiveSubscription(status: SubscriptionStatus): boolean {
  // past_due / unpaid / canceled / none do NOT unlock paid access
  return status === "active" || status === "trialing";
}

export async function getTrialInspectionUsage(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const used = await countCompletedInspections(userId);
  return {
    used,
    remaining: Math.max(0, FREE_TRIAL_INSPECTIONS - used),
    limit: FREE_TRIAL_INSPECTIONS,
  };
}

/** @deprecated Use getTrialInspectionUsage */
export const getTrialScanUsage = getTrialInspectionUsage;

export type CommunityTrialStatus =
  | { status: "no_community" }
  | { status: "available"; communityKey: string }
  | {
      status: "claimed_by_you";
      communityKey: string;
      hoaName: string;
    }
  | {
      status: "claimed_by_other";
      communityKey: string;
      hoaName: string;
    }
  | { status: "unavailable"; reason: string };

/** Look up whether this community's free trial is still open. */
export async function getCommunityTrialStatus(
  userId: string,
  hoaName?: string | null
): Promise<CommunityTrialStatus> {
  const admin = createAdminClient();
  if (!admin) {
    return { status: "unavailable", reason: "Database not configured" };
  }

  const sub = await getUserSubscription(userId);
  const name = (hoaName ?? sub.hoaName ?? "").trim();
  if (!name) return { status: "no_community" };

  if (!isValidCommunityName(name)) {
    return {
      status: "unavailable",
      reason: "Enter your real HOA / community name (not “test” or “demo”).",
    };
  }

  const key = normalizeCommunityKey(name);

  const { data: claim } = await admin
    .from("community_trials")
    .select("community_key, claimed_by, hoa_name")
    .eq("community_key", key)
    .maybeSingle();

  if (!claim) return { status: "available", communityKey: key };

  if (claim.claimed_by === userId) {
    return {
      status: "claimed_by_you",
      communityKey: key,
      hoaName: claim.hoa_name,
    };
  }

  return {
    status: "claimed_by_other",
    communityKey: key,
    hoaName: claim.hoa_name,
  };
}

/**
 * Claim the free trial for a community (first account wins).
 * Safe to call repeatedly for the same user.
 */
export async function claimCommunityTrial(
  userId: string,
  hoaName: string
): Promise<
  | { ok: true; communityKey: string; alreadyOwned: boolean }
  | { ok: false; error: string; code: string }
> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Database not configured", code: "NO_DB" };
  }

  const trimmed = hoaName.trim();
  if (!isValidCommunityName(trimmed)) {
    return {
      ok: false,
      error: "Enter a community name with at least a few letters (e.g. Test HOA).",
      code: "INVALID_COMMUNITY",
    };
  }

  const key = normalizeCommunityKey(trimmed);

  // Sync profile first
  await admin.from("profiles").upsert({
    id: userId,
    hoa_name: trimmed,
    community_key: key,
  });

  // One free-trial community per account
  const { data: myClaims } = await admin
    .from("community_trials")
    .select("community_key, hoa_name")
    .eq("claimed_by", userId);

  const mine = myClaims ?? [];
  const exactMine = mine.find((c) => c.community_key === key);
  if (exactMine) {
    // Same claim — refresh display name
    await admin
      .from("community_trials")
      .update({ hoa_name: trimmed })
      .eq("community_key", key)
      .eq("claimed_by", userId);
    return { ok: true, communityKey: key, alreadyOwned: true };
  }

  // Allow renaming / moving the single free-trial claim (no subscribe needed)
  if (mine.length === 1 && mine[0].community_key !== key) {
    const { data: taken } = await admin
      .from("community_trials")
      .select("claimed_by, hoa_name")
      .eq("community_key", key)
      .maybeSingle();
    if (taken && taken.claimed_by !== userId) {
      return {
        ok: false,
        error: `Free trial for “${taken.hoa_name}” was already used. Pick another name or subscribe.`,
        code: "COMMUNITY_TRIAL_USED",
      };
    }
    await admin.from("community_trials").delete().eq("claimed_by", userId);
    const { error: moveError } = await admin.from("community_trials").insert({
      community_key: key,
      claimed_by: userId,
      hoa_name: trimmed,
    });
    if (moveError) {
      console.error("claimCommunityTrial move failed:", moveError.message);
      return {
        ok: false,
        error: "Could not update community. Try again.",
        code: "CLAIM_FAILED",
      };
    }
    return { ok: true, communityKey: key, alreadyOwned: true };
  }

  if (mine.length > 1) {
    return {
      ok: false,
      error: `Your free trial is already tied to “${mine[0].hoa_name}”. Subscribe to add another community.`,
      code: "ALREADY_CLAIMED_OTHER",
    };
  }

  const { data: existing } = await admin
    .from("community_trials")
    .select("claimed_by, hoa_name")
    .eq("community_key", key)
    .maybeSingle();

  if (existing) {
    if (existing.claimed_by === userId) {
      return { ok: true, communityKey: key, alreadyOwned: true };
    }
    return {
      ok: false,
      error: `Free trial for “${existing.hoa_name}” was already used. Subscribe to continue for this community.`,
      code: "COMMUNITY_TRIAL_USED",
    };
  }

  const { error } = await admin.from("community_trials").insert({
    community_key: key,
    claimed_by: userId,
    hoa_name: trimmed,
  });

  if (error) {
    // Race: another signup claimed it between select and insert
    if (error.code === "23505") {
      return {
        ok: false,
        error: `Free trial for this community was already claimed. Subscribe to continue.`,
        code: "COMMUNITY_TRIAL_USED",
      };
    }
    // Table missing — don't block setup; warn in logs
    if (
      error.message?.includes("community_trials") ||
      error.code === "42P01"
    ) {
      console.error(
        "community_trials table missing — run docs/MIGRATE_COMMUNITY_TRIALS.sql"
      );
      return { ok: true, communityKey: key, alreadyOwned: false };
    }
    console.error("claimCommunityTrial failed:", error.message);
    return {
      ok: false,
      error: "Could not claim community trial. Try again.",
      code: "CLAIM_FAILED",
    };
  }

  return { ok: true, communityKey: key, alreadyOwned: false };
}

/** Live inspections: 3 free per community, then subscription when Stripe is configured. */
export async function canRunLiveInspection(userId: string | null): Promise<{
  allowed: boolean;
  reason?: string;
  code?: string;
  inspectionsRemaining?: number;
}> {
  // Always require sign-in for live AI (prevents anonymous OpenAI abuse)
  if (!userId) {
    return { allowed: false, reason: "Sign in required for live inspections." };
  }

  if (!isStripeConfigured()) {
    return { allowed: true };
  }

  const sub = await getUserSubscription(userId);
  if (hasActiveSubscription(sub.status)) {
    return { allowed: true };
  }

  // Must have a community name before free scans (testing names like "Test HOA" are OK)
  if (!sub.hoaName?.trim()) {
    return {
      allowed: false,
      code: "COMMUNITY_REQUIRED",
      reason:
        "Add a community name in Settings → Profile first (e.g. “Test HOA” while you’re trying it out).",
    };
  }

  const community = await getCommunityTrialStatus(userId, sub.hoaName);
  if (community.status === "claimed_by_other") {
    return {
      allowed: false,
      code: "COMMUNITY_TRIAL_USED",
      reason: `Free trial for “${community.hoaName}” was already used by another account. Subscribe to continue for this community.`,
    };
  }
  if (community.status === "unavailable") {
    return {
      allowed: false,
      code: "INVALID_COMMUNITY",
      reason: community.reason,
    };
  }
  if (community.status === "no_community") {
    return {
      allowed: false,
      code: "COMMUNITY_REQUIRED",
      reason:
        "Add a community name in Settings → Profile first (e.g. “Test HOA” while you’re trying it out).",
    };
  }

  // Claim trial if needed (also writes community_key when missing)
  if (community.status === "available" || !sub.communityKey) {
    const claim = await claimCommunityTrial(userId, sub.hoaName);
    if (!claim.ok) {
      return {
        allowed: false,
        code: claim.code,
        reason: claim.error,
      };
    }
  }

  const { used, remaining } = await getTrialInspectionUsage(userId);
  if (used < FREE_TRIAL_INSPECTIONS) {
    return { allowed: true, inspectionsRemaining: remaining };
  }

  return {
    allowed: false,
    code: "TRIAL_EXHAUSTED",
    reason: `You've used all ${FREE_TRIAL_INSPECTIONS} free inspections. Subscribe to continue.`,
  };
}
