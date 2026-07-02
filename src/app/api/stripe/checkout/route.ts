import { NextRequest, NextResponse } from "next/server";
import {
  getStripe,
  getStripePriceId,
  getAppUrl,
  isStripeConfigured,
  type BillingPlan,
} from "@/lib/stripe";
import { buildCheckoutBranding } from "@/lib/stripe-branding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

function parsePlan(value: unknown): BillingPlan {
  return value === "professional" ? "professional" : "starter";
}

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
    const plan = parsePlan(body?.plan);
    const embedded = Boolean(body?.embedded);
    const priceId = getStripePriceId(plan);
    if (!priceId) {
      const envName =
        plan === "professional"
          ? "STRIPE_PRICE_PRO"
          : "STRIPE_PRICE_STARTER or STRIPE_PRICE_ID";
      return NextResponse.json(
        {
          error: `${envName} missing. In Stripe, copy the Price ID (price_...), not the Product ID (prod_...).`,
        },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const admin = createAdminClient();
    let customerId: string | null = null;

    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id, email")
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
    }

    const appUrl = getAppUrl();
    const branding = buildCheckoutBranding(appUrl);

    const baseSession = {
      mode: "subscription" as const,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      branding_settings: branding,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan },
      },
      metadata: { supabase_user_id: user.id, plan },
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

      return NextResponse.json({ clientSecret: session.client_secret });
    }

    const session = await stripe.checkout.sessions.create({
      ...baseSession,
      success_url: `${appUrl}/dashboard/settings?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return NextResponse.json({ error: stripeErrorMessage(err) }, { status: 500 });
  }
}
