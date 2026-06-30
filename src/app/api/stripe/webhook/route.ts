import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY required for webhooks" }, { status: 503 });
  }

  async function updateByCustomer(
    customerId: string,
    fields: Record<string, string | null>
  ) {
    await admin!
      .from("profiles")
      .update(fields)
      .eq("stripe_customer_id", customerId);
  }

  async function updateByUserId(userId: string, fields: Record<string, string | null>) {
    await admin!.from("profiles").update(fields).eq("id", userId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan ?? "starter";
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;

      const fields = {
        subscription_status: "trialing",
        plan,
        stripe_customer_id: customerId ?? null,
      };

      if (userId) await updateByUserId(userId, fields);
      else if (customerId) await updateByCustomer(customerId, fields);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const plan = sub.metadata?.plan ?? "starter";
      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : sub.status === "trialing"
            ? "trialing"
            : sub.status === "active"
              ? "active"
              : sub.status;

      await updateByCustomer(customerId, {
        subscription_status: status,
        plan,
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await updateByCustomer(customerId, { subscription_status: "active" });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
