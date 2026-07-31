import type { SupabaseClient } from "@supabase/supabase-js";

/** Logged by Stripe webhook — timestamps live in metadata.stripeEventAt when available. */
export const SUBSCRIPTION_ACTIONS = [
  "subscription.checkout_completed",
  "subscription.activated",
  "subscription.trialing",
] as const;

export type SubscriptionAction = (typeof SUBSCRIPTION_ACTIONS)[number];

export interface SubscriptionEventRow {
  action: string;
  created_at: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
}

export function isActiveSubscriptionStatus(
  status: string | null | undefined
): boolean {
  return status === "active" || status === "trialing";
}

export function subscriptionTimestampFromEvent(row: {
  created_at: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const stripeAt = row.metadata?.stripeEventAt;
  if (typeof stripeAt === "string" && stripeAt.trim()) return stripeAt;
  return row.created_at;
}

export async function logSubscriptionEvent(
  db: SupabaseClient,
  profileId: string,
  action: SubscriptionAction,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from("nexus_actions").insert({
    actor: "stripe",
    action,
    entity_type: "profile",
    entity_id: profileId,
    metadata,
  });
  if (error) {
    console.error("[subscription-event]", action, error.message);
  }
}

export async function loadSubscriptionEvents(
  db: SupabaseClient,
  sinceIso: string,
  profileIds?: string[]
): Promise<Map<string, SubscriptionEventRow[]>> {
  let query = db
    .from("nexus_actions")
    .select("action, created_at, entity_id, metadata")
    .in("action", [...SUBSCRIPTION_ACTIONS])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(500);

  if (profileIds?.length) {
    query = query.in("entity_id", profileIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error("loadSubscriptionEvents:", error.message);
    return new Map();
  }

  const byProfile = new Map<string, SubscriptionEventRow[]>();
  for (const row of data ?? []) {
    const profileId = String(
      (row as { entity_id?: string }).entity_id ?? ""
    ).trim();
    if (!profileId) continue;
    const list = byProfile.get(profileId) ?? [];
    list.push({
      action: String((row as { action?: string }).action ?? ""),
      created_at: String((row as { created_at?: string }).created_at ?? ""),
      entity_id: profileId,
      metadata:
        ((row as { metadata?: Record<string, unknown> }).metadata as Record<
          string,
          unknown
        >) ?? {},
    });
    byProfile.set(profileId, list);
  }
  return byProfile;
}

export type SubscribedAtSource = "stripe_event" | "community_trial" | "unknown";

export function resolveSubscriptionTiming(input: {
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeEvents: SubscriptionEventRow[];
  trialClaimedAt: string | null;
}): {
  isSubscribed: boolean;
  subscribedAt: string | null;
  subscribedAtSource: SubscribedAtSource | null;
} {
  const isSubscribed = isActiveSubscriptionStatus(input.subscriptionStatus);
  if (!isSubscribed) {
    return { isSubscribed: false, subscribedAt: null, subscribedAtSource: null };
  }

  if (input.stripeEvents.length > 0) {
    const sorted = [...input.stripeEvents].sort(
      (a, b) =>
        new Date(subscriptionTimestampFromEvent(a)).getTime() -
        new Date(subscriptionTimestampFromEvent(b)).getTime()
    );
    return {
      isSubscribed: true,
      subscribedAt: subscriptionTimestampFromEvent(sorted[0]!),
      subscribedAtSource: "stripe_event",
    };
  }

  if (input.trialClaimedAt) {
    return {
      isSubscribed: true,
      subscribedAt: input.trialClaimedAt,
      subscribedAtSource: "community_trial",
    };
  }

  if (input.stripeCustomerId || input.subscriptionStatus === "active") {
    return {
      isSubscribed: true,
      subscribedAt: null,
      subscribedAtSource: "unknown",
    };
  }

  return { isSubscribed: true, subscribedAt: null, subscribedAtSource: "unknown" };
}
