import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function mapStripeStatus(status: Stripe.Subscription.Status | string): string {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "inactive";
    default:
      return "inactive";
  }
}

function parseCommunityCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

function parsePriceMonthly(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY required for webhooks" },
      { status: 503 }
    );
  }

  async function updateByCustomer(
    customerId: string,
    fields: Record<string, string | number | null>
  ): Promise<void> {
    const { error } = await admin!
      .from("profiles")
      .update(fields)
      .eq("stripe_customer_id", customerId);
    if (error) throw new Error(`Profile update failed: ${error.message}`);
  }

  async function updateByUserId(
    userId: string,
    fields: Record<string, string | number | null>
  ): Promise<void> {
    const { error } = await admin!.from("profiles").update(fields).eq("id", userId);
    if (error) throw new Error(`Profile update failed: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan || "community";
        const communityCount = parseCommunityCount(session.metadata?.community_count);
        const priceMonthly = parsePriceMonthly(session.metadata?.price_monthly);
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        const fields: Record<string, string | number | null> = {
          subscription_status: "active",
          plan,
          stripe_customer_id: customerId ?? null,
        };
        if (communityCount != null) fields.community_count = communityCount;
        if (priceMonthly != null) fields.price_monthly = priceMonthly;

        if (userId) await updateByUserId(userId, fields);
        else if (customerId) await updateByCustomer(customerId, fields);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const plan = sub.metadata?.plan || "community";
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : mapStripeStatus(sub.status);
        const communityCount = parseCommunityCount(sub.metadata?.community_count);
        const priceMonthly = parsePriceMonthly(sub.metadata?.price_monthly);

        const fields: Record<string, string | number | null> = {
          subscription_status: status,
          plan,
        };
        if (communityCount != null) fields.community_count = communityCount;
        if (priceMonthly != null) fields.price_monthly = priceMonthly;

        await updateByCustomer(customerId, fields);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          await updateByCustomer(customerId, { subscription_status: "active" });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          await updateByCustomer(customerId, { subscription_status: "past_due" });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
