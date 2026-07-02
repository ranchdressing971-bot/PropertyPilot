import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Free live inspections before subscription is required (when Stripe is configured). */
export const FREE_TRIAL_INSPECTIONS = 3;

/** @deprecated Use FREE_TRIAL_INSPECTIONS */
export const FREE_TRIAL_SCANS = FREE_TRIAL_INSPECTIONS;

export type BillingPlan = "starter" | "professional";

export const PLANS: Record<
  BillingPlan,
  { label: string; priceLabel: string; priceMonthly: number }
> = {
  starter: {
    label: "Starter",
    priceLabel: "$149/mo",
    priceMonthly: 149,
  },
  professional: {
    label: "Professional",
    priceLabel: "$299/mo",
    priceMonthly: 299,
  },
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/** Checkout needs a Price ID (price_...), not a Product ID (prod_...). */
export function getStripePriceId(plan: BillingPlan = "starter"): string | null {
  if (plan === "professional") {
    return (
      process.env.STRIPE_PRICE_PRO ??
      process.env.STRIPE_PRICE_PROFESSIONAL ??
      null
    );
  }
  return (
    process.env.STRIPE_PRICE_STARTER ??
    process.env.STRIPE_PRICE_ID ??
    null
  );
}

export function getCheckoutDisplayName(): string {
  return process.env.STRIPE_CHECKOUT_DISPLAY_NAME?.trim() || "Property Pilot";
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
