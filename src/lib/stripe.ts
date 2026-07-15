import Stripe from "stripe";
import {
  PLANS,
  FREE_TRIAL_INSPECTIONS,
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  type BillingPlan,
} from "./stripe-client";

export {
  PLANS,
  FREE_TRIAL_INSPECTIONS,
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  type BillingPlan,
};
export {
  MAX_COMMUNITIES,
  MIN_COMMUNITIES,
  PRICING_BASE,
  PRICING_EXPONENT,
  pricingSamples,
} from "./stripe-client";

let stripe: Stripe | null = null;

/** @deprecated Use FREE_TRIAL_INSPECTIONS */
export const FREE_TRIAL_SCANS = FREE_TRIAL_INSPECTIONS;

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

/**
 * Optional Stripe Product ID for community pricing (prod_...).
 * If unset, Checkout creates product_data inline.
 */
export function getStripeProductId(): string | null {
  return process.env.STRIPE_PRODUCT_ID?.trim() || null;
}

/** @deprecated Fixed Price IDs — community formula uses dynamic price_data. */
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
  return process.env.STRIPE_CHECKOUT_DISPLAY_NAME?.trim() || "RideBy";
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

/** Build Stripe line item for P(c) = 99 × c^0.7 */
export function buildCommunitySubscriptionLineItem(communities: number): {
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  communityCount: number;
  priceMonthly: number;
  priceLabel: string;
} {
  const communityCount = clampCommunities(communities);
  const priceMonthly = priceForCommunities(communityCount);
  const priceLabel = formatPriceMonthly(priceMonthly);
  const productId = getStripeProductId();

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: "usd",
    unit_amount: priceMonthly * 100,
    recurring: { interval: "month" },
    ...(productId
      ? { product: productId }
      : {
          product_data: {
            name: "RideBy",
            description:
              communityCount === 1
                ? "1 community · monthly"
                : `${communityCount} communities · monthly`,
          },
        }),
  };

  return {
    lineItem: { price_data: priceData, quantity: 1 },
    communityCount,
    priceMonthly,
    priceLabel,
  };
}
