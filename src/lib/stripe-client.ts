/** Client-safe pricing helpers — P(c) = 99 × c^0.7 */

export const PRICING_BASE = 99;
export const PRICING_EXPONENT = 0.7;
export const MIN_COMMUNITIES = 1;
export const MAX_COMMUNITIES = 300;

/**
 * Free live inspections per signed-in account before subscription is required
 * (when Stripe is configured). Exactly one — not per day, not unlimited demo.
 */
export const FREE_TRIAL_INSPECTIONS = 1;

/** Monthly price in whole dollars for `c` communities. */
export function priceForCommunities(communities: number): number {
  const c = clampCommunities(communities);
  return Math.round(PRICING_BASE * Math.pow(c, PRICING_EXPONENT));
}

export function formatPriceMonthly(amount: number): string {
  return `$${amount}/mo`;
}

export function clampCommunities(communities: number): number {
  if (!Number.isFinite(communities)) return MIN_COMMUNITIES;
  return Math.min(
    MAX_COMMUNITIES,
    Math.max(MIN_COMMUNITIES, Math.round(communities))
  );
}

/** Sample table for pricing page / docs. */
export function pricingSamples(counts: number[] = [1, 2, 3, 5, 10, 20]): {
  communities: number;
  priceMonthly: number;
  priceLabel: string;
}[] {
  return counts.map((communities) => {
    const priceMonthly = priceForCommunities(communities);
    return {
      communities,
      priceMonthly,
      priceLabel: formatPriceMonthly(priceMonthly),
    };
  });
}

/** @deprecated Legacy dual-plan labels — community formula is the live model. */
export type BillingPlan = "starter" | "professional" | "community";

export const PLANS: Record<
  "starter" | "professional",
  { label: string; priceLabel: string; priceMonthly: number }
> = {
  starter: {
    label: "Starter",
    priceLabel: formatPriceMonthly(priceForCommunities(1)),
    priceMonthly: priceForCommunities(1),
  },
  professional: {
    label: "Professional",
    priceLabel: formatPriceMonthly(priceForCommunities(5)),
    priceMonthly: priceForCommunities(5),
  },
};
