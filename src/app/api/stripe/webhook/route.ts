import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe-invoices";

/**
 * Stripe webhook for invoice payments (test mode).
 * In V1, demo payments update client-side state; this endpoint
 * acknowledges Stripe events and is ready for Supabase persistence.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !secret) {
    return NextResponse.json(
      { received: true, note: "Webhook secret not configured — acknowledged." },
      { status: 200 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded"
    ) {
      const object = event.data.object as {
        metadata?: { payment_token?: string; invoice_number?: string };
        payment_intent?: string;
        id?: string;
      };
      console.info("TradeFlow payment event", {
        type: event.type,
        paymentToken: object.metadata?.payment_token,
        invoiceNumber: object.metadata?.invoice_number,
        paymentId: object.payment_intent ?? object.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook", error);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}
