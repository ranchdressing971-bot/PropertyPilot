import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_TRIAL_SCANS, isStripeConfigured } from "@/lib/stripe";

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
    return { status: "none", plan: null, stripeCustomerId: null };
  }

  const { data } = await admin
    .from("profiles")
    .select("subscription_status, plan, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (!data) {
    return { status: "none", plan: null, stripeCustomerId: null };
  }

  return {
    status: (data.subscription_status as SubscriptionStatus) ?? "none",
    plan: data.plan ?? null,
    stripeCustomerId: data.stripe_customer_id ?? null,
  };
}

export function hasActiveSubscription(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export async function getTrialScanUsage(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const used = await countCompletedInspections(userId);
  return {
    used,
    remaining: Math.max(0, FREE_TRIAL_SCANS - used),
    limit: FREE_TRIAL_SCANS,
  };
}

/** Live scans: 3 free, then $149/mo subscription when Stripe is configured. */
export async function canRunLiveInspection(userId: string | null): Promise<{
  allowed: boolean;
  reason?: string;
  scansRemaining?: number;
}> {
  if (!isStripeConfigured()) {
    return { allowed: true };
  }

  if (!userId) {
    return { allowed: false, reason: "Sign in required for live inspections." };
  }

  const sub = await getUserSubscription(userId);
  if (hasActiveSubscription(sub.status)) {
    return { allowed: true };
  }

  const { used, remaining } = await getTrialScanUsage(userId);
  if (used < FREE_TRIAL_SCANS) {
    return { allowed: true, scansRemaining: remaining };
  }

  return {
    allowed: false,
    reason: `You've used all ${FREE_TRIAL_SCANS} free scans. Subscribe for $149/mo to continue.`,
  };
}
