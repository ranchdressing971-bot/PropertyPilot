import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  isStripeConfigured,
  clampCommunities,
  updateCommunitySubscription,
  findActiveCommunitySubscription,
} from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getUserSubscription,
  hasActiveSubscription,
} from "@/lib/subscription";

function stripeErrorMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Could not update communities";
}

/**
 * POST { communityCount }
 * Upsell path for existing subscribers: raises plan community_count / monthly
 * amount with Stripe proration. Webhook syncs profiles from subscription metadata.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment." },
        { status: 503 }
      );
    }

    const secret = process.env.STRIPE_SECRET_KEY ?? "";
    if (secret.startsWith("rk_")) {
      return NextResponse.json(
        {
          error:
            "STRIPE_SECRET_KEY is a restricted key (rk_...). Use a secret key (sk_live_... or sk_test_...) for billing updates.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const communityCount = clampCommunities(
      Number(body?.communityCount ?? body?.communities ?? NaN)
    );

    const sub = await getUserSubscription(user.id);
    if (!hasActiveSubscription(sub.status)) {
      return NextResponse.json(
        {
          error: "Subscribe first from Pricing, then you can add communities here.",
          code: "NOT_SUBSCRIBED",
        },
        { status: 400 }
      );
    }

    if (!sub.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet. Complete checkout from Pricing first." },
        { status: 400 }
      );
    }

    const currentCount = Math.max(1, sub.communityCount || 1);
    if (communityCount <= currentCount) {
      return NextResponse.json(
        {
          error: `You already have ${currentCount} communit${
            currentCount === 1 ? "y" : "ies"
          }. Choose a higher number to add more.`,
          code: "NOT_AN_INCREASE",
          communityCount: currentCount,
        },
        { status: 400 }
      );
    }

    // Confirm Stripe still has an active subscription (profile can lag)
    const stripeSub = await findActiveCommunitySubscription(sub.stripeCustomerId);
    if (!stripeSub) {
      return NextResponse.json(
        {
          error:
            "No active Stripe subscription found. Use Pricing to subscribe, or Manage billing if something looks wrong.",
          code: "NO_STRIPE_SUB",
        },
        { status: 400 }
      );
    }

    const result = await updateCommunitySubscription({
      customerId: sub.stripeCustomerId,
      userId: user.id,
      communityCount,
      requireIncreaseFrom: currentCount,
      currentPriceMonthly: sub.priceMonthly,
    });

    // Optimistic profile sync; webhook customer.subscription.updated is source of truth
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("profiles")
        .update({
          community_count: result.communityCount,
          price_monthly: result.priceMonthly,
          subscription_status: "active",
          plan: "community",
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      ok: true,
      communityCount: result.communityCount,
      previousCommunityCount: result.previousCommunityCount,
      priceMonthly: result.priceMonthly,
      previousPriceMonthly: result.previousPriceMonthly,
      priceLabel: result.priceLabel,
      subscriptionId: result.subscriptionId,
      prorated: true,
    });
  } catch (err) {
    console.error("Stripe update-communities failed:", err);
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 });
  }
}
