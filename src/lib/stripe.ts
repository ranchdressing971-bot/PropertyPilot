import Stripe from "stripe";
import {
  PLANS,
  FREE_TRIAL_INSPECTIONS,
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  upsellPriceForCommunities,
  type BillingPlan,
} from "./stripe-client";

export {
  PLANS,
  FREE_TRIAL_INSPECTIONS,
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  upsellPriceForCommunities,
  type BillingPlan,
};
export {
  MAX_COMMUNITIES,
  MIN_COMMUNITIES,
  PRICING_BASE,
  PRICING_EXPONENT,
  FLAT_TIER_MAX_COMMUNITIES,
  FLAT_TIER_PRICE,
  pricingSamples,
  pricingFormulaLabel,
  volumePriceForCommunities,
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
 * If unset, Checkout / updates create product_data inline.
 *
 * Dashboard: Products → Add product "RideBy" (or your brand) → copy prod_...
 * Prices are created dynamically from the community formula; fixed Price IDs
 * (STRIPE_PRICE_STARTER / PRO) are legacy and unused for new checkouts.
 */
export function getStripeProductId(): string | null {
  return process.env.STRIPE_PRODUCT_ID?.trim() || null;
}

/** @deprecated Fixed Price IDs - community formula uses dynamic price_data. */
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

export function communitySubscriptionMetadata(
  userId: string,
  communityCount: number,
  priceMonthly: number
): Record<string, string> {
  return {
    supabase_user_id: userId,
    plan: "community",
    community_count: String(communityCount),
    price_monthly: String(priceMonthly),
  };
}

/**
 * Build Stripe line item for community pricing.
 * Single quantity=1 item with the full monthly amount (pricing is non-linear,
 * so we do not use per-community Stripe quantity).
 */
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
  const displayName = getCheckoutDisplayName();

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: "usd",
    unit_amount: priceMonthly * 100,
    recurring: { interval: "month" },
    ...(productId
      ? { product: productId }
      : {
          product_data: {
            name: displayName,
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

/** Active or trialing subscription for a Stripe customer, if any. */
export async function findActiveCommunitySubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const stripeClient = getStripe();
  for (const status of ["active", "trialing"] as const) {
    const list = await stripeClient.subscriptions.list({
      customer: customerId,
      status,
      limit: 5,
    });
    const match = list.data.find((sub) => sub.items.data.length > 0);
    if (match) return match;
  }
  return null;
}

/**
 * Ensure we have a Product id for creating Prices during subscription updates.
 */
async function resolveProductIdForPrice(): Promise<string> {
  const existing = getStripeProductId();
  if (existing) return existing;

  const stripeClient = getStripe();
  const product = await stripeClient.products.create({
    name: getCheckoutDisplayName(),
    metadata: { rideby_billing: "community" },
  });
  return product.id;
}

export type UpdateCommunitySubscriptionResult = {
  subscriptionId: string;
  communityCount: number;
  previousCommunityCount: number;
  priceMonthly: number;
  previousPriceMonthly: number;
  priceLabel: string;
};

/**
 * Increase (or set) communities on an existing subscription.
 * Uses the published price table (flat $299 for 1-3, volume curve above),
 * never below the current monthly amount. Creates a new Price, swaps the
 * subscription item, updates metadata, and prorates immediately.
 */
export async function updateCommunitySubscription(params: {
  customerId: string;
  userId: string;
  communityCount: number;
  /** If set, require new count to be strictly greater (add-on path). */
  requireIncreaseFrom?: number;
  /** Preferred current monthly from profiles.price_monthly when known. */
  currentPriceMonthly?: number | null;
}): Promise<UpdateCommunitySubscriptionResult> {
  const communityCount = clampCommunities(params.communityCount);

  if (
    params.requireIncreaseFrom != null &&
    communityCount <= params.requireIncreaseFrom
  ) {
    throw new Error(
      `Choose more than ${params.requireIncreaseFrom} communit${
        params.requireIncreaseFrom === 1 ? "y" : "ies"
      } to upgrade.`
    );
  }

  const stripeClient = getStripe();
  const subscription = await findActiveCommunitySubscription(params.customerId);
  if (!subscription) {
    throw new Error("No active subscription found. Start a plan from Pricing.");
  }

  const item = subscription.items.data[0];
  if (!item) {
    throw new Error("Subscription has no billable items.");
  }

  const previousCommunityCount = Math.max(
    1,
    Number(subscription.metadata?.community_count) ||
      params.requireIncreaseFrom ||
      1
  );

  const fromStripeUnit =
    item.price.unit_amount != null
      ? Math.round(item.price.unit_amount / 100)
      : 0;
  const fromMeta = Number(subscription.metadata?.price_monthly);
  const previousPriceMonthly = Math.max(
    0,
    Number(params.currentPriceMonthly) ||
      (Number.isFinite(fromMeta) ? fromMeta : 0) ||
      fromStripeUnit ||
      priceForCommunities(previousCommunityCount)
  );

  // Same published table as Pricing; never below what they already pay.
  const priceMonthly = upsellPriceForCommunities(
    communityCount,
    previousPriceMonthly
  );
  const priceLabel = formatPriceMonthly(priceMonthly);

  const productId = item.price.product
    ? typeof item.price.product === "string"
      ? item.price.product
      : item.price.product.id
    : await resolveProductIdForPrice();

  const newPrice = await stripeClient.prices.create({
    currency: "usd",
    unit_amount: priceMonthly * 100,
    recurring: { interval: "month" },
    product: productId,
    nickname: `${communityCount} communities · ${priceLabel}`,
    metadata: {
      community_count: String(communityCount),
      price_monthly: String(priceMonthly),
      pricing_path: "upsell",
    },
  });

  const meta = communitySubscriptionMetadata(
    params.userId,
    communityCount,
    priceMonthly
  );

  await stripeClient.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: newPrice.id }],
    proration_behavior: "create_prorations",
    metadata: meta,
  });

  return {
    subscriptionId: subscription.id,
    communityCount,
    previousCommunityCount,
    priceMonthly,
    previousPriceMonthly,
    priceLabel,
  };
}
