import { NextResponse } from "next/server";
import { appUrl, getStripe, isStripeTestConfigured } from "@/lib/stripe-invoices";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const invoiceNumber = String(body.invoiceNumber ?? "Invoice");
    const paymentToken = String(body.paymentToken ?? "");
    const customerEmail = body.customerEmail ? String(body.customerEmail) : undefined;

    if (!amount || amount <= 0 || !paymentToken) {
      return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
    }

    if (!isStripeTestConfigured()) {
      return NextResponse.json(
        {
          error: "Stripe test mode is not configured.",
          demo: true,
        },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe unavailable." }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Invoice ${invoiceNumber}`,
              description: "HVAC service payment via TradeFlow",
            },
          },
        },
      ],
      metadata: {
        payment_token: paymentToken,
        invoice_number: invoiceNumber,
      },
      success_url: `${appUrl()}/pay/${paymentToken}?paid=1`,
      cancel_url: `${appUrl()}/pay/${paymentToken}?cancelled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("invoice-checkout", error);
    return NextResponse.json(
      { error: "Unable to start checkout. Try again or mark paid in demo." },
      { status: 500 }
    );
  }
}
