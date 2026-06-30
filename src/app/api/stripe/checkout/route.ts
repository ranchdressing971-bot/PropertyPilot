import { NextRequest, NextResponse } from "next/server";
import { getStripe, getStripePriceId, getAppUrl, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment." },
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
  const plan = body.plan === "professional" ? "professional" : "starter";
  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID missing for ${plan}. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO.` },
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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : user.email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: user.id, plan },
    },
    metadata: { supabase_user_id: user.id, plan },
    success_url: `${appUrl}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl}/pricing?billing=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
