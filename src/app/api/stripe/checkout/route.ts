import { NextRequest, NextResponse } from "next/server";
import {
  getStripe,
  getAppUrl,
  isStripeConfigured,
  buildCommunitySubscriptionLineItem,
  clampCommunities,
  communitySubscriptionMetadata,
  findActiveCommunitySubscription,
  updateCommunitySubscription,
} from "@/lib/stripe";
import { buildCheckoutBranding } from "@/lib/stripe-branding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getUserSubscription,
  hasActiveSubscription,
} from "@/lib/subscription";
import Stripe from "stripe";

function stripeErrorMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Checkout session failed";
}

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
            "STRIPE_SECRET_KEY is a restricted key (rk_...). Use a secret key (sk_live_... or sk_test_...) for Checkout.",
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
    const embedded = Boolean(body?.embedded);
    const communityCount = clampCommunities(
      Number(body?.communityCount ?? body?.communities ?? 1)
    );

    const { lineItem, priceMonthly, priceLabel } =
      buildCommunitySubscriptionLineItem(communityCount);

    const stripe = getStripe();
    const admin = createAdminClient();
    let customerId: string | null = null;

    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id, email, subscription_status, community_count")
        .eq("id", user.id)
        .maybeSingle();
      customerId = profile?.stripe_customer_id ?? null;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? profile?.email ?? undefined,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        await admin.from("profiles").upsert({
          id: user.id,
          email: user.email,
          stripe_customer_id: customerId,
        });
      }

      // Already subscribed: upgrade in place (prorated) instead of a second Checkout
      const profileSub = await getUserSubscription(user.id);
      if (
        customerId &&
        hasActiveSubscription(profileSub.status) &&
        (await findActiveCommunitySubscription(customerId))
      ) {
        const currentCount = Math.max(1, profileSub.communityCount || 1);
        if (communityCount <= currentCount) {
          return NextResponse.json(
            {
              error: `You already subscribe for ${currentCount} communit${
                currentCount === 1 ? "y" : "ies"
              }. Choose a higher number, or manage billing in Settings.`,
              code: "ALREADY_SUBSCRIBED",
              communityCount: currentCount,
              updated: false,
            },
            { status: 400 }
          );
        }

        const result = await updateCommunitySubscription({
          customerId,
          userId: user.id,
          communityCount,
          requireIncreaseFrom: currentCount,
          currentPriceMonthly: profileSub.priceMonthly,
        });

        await admin
          .from("profiles")
          .update({
            community_count: result.communityCount,
            price_monthly: result.priceMonthly,
            subscription_status: "active",
            plan: "community",
          })
          .eq("id", user.id);

        return NextResponse.json({
          updated: true,
          communityCount: result.communityCount,
          previousCommunityCount: result.previousCommunityCount,
          priceMonthly: result.priceMonthly,
          previousPriceMonthly: result.previousPriceMonthly,
          priceLabel: result.priceLabel,
          redirectUrl: `${getAppUrl()}/dashboard/settings?billing=success`,
        });
      }
    }

    const appUrl = getAppUrl();
    const branding = buildCheckoutBranding(appUrl, { embedded });
    const meta = communitySubscriptionMetadata(
      user.id,
      communityCount,
      priceMonthly
    );

    const baseSession = {
      mode: "subscription" as const,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email ?? undefined,
      line_items: [lineItem],
      branding_settings: branding,
      subscription_data: {
        metadata: meta,
      },
      metadata: meta,
    };

    if (embedded) {
      const session = await stripe.checkout.sessions.create({
        ...baseSession,
        ui_mode: "embedded_page",
        return_url: `${appUrl}/dashboard/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      });

      if (!session.client_secret) {
        return NextResponse.json(
          { error: "Could not start embedded checkout session." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        clientSecret: session.client_secret,
        communityCount,
        priceMonthly,
        priceLabel,
        updated: false,
      });
    }

    const session = await stripe.checkout.sessions.create({
      ...baseSession,
      success_url: `${appUrl}/dashboard/settings?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=canceled`,
    });

    return NextResponse.json({
      url: session.url,
      communityCount,
      priceMonthly,
      priceLabel,
      updated: false,
    });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 });
  }
}
