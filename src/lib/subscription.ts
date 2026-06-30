import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/stripe";

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

/** Live inspections allowed when Stripe is off (dev) or subscription is active/trialing. */
export async function canRunLiveInspection(userId: string | null): Promise<{
  allowed: boolean;
  reason?: string;
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

  return {
    allowed: false,
    reason: "Active subscription required. Start your free trial on the Pricing page.",
  };
}
