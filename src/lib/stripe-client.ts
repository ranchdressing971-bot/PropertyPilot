/**
 * Community pricing (monthly, whole dollars):
 *
 *   Flat band:  c = 1, 2, or 3  →  $299/mo
 *   Above band: c > 3           →  max(299, round(99 × c^0.7))
 *
 * The volume curve P(c) = 99 × c^0.7 is the existing multi-community equation.
 * We floor at $299 so adding communities never undercuts the flat band
 * (raw P(4) ≈ $261 would otherwise be cheaper than 1-3).
 *
 * Buy-more / upgrades use the same table, never below the subscriber's
 * current monthly amount (so seats can increase at the same rate inside
 * the flat band, and legacy under-priced plans get pulled up to the table).
 */

export const PRICING_BASE = 99;
export const PRICING_EXPONENT = 0.7;
/** Inclusive: communities 1..FLAT_TIER_MAX all pay FLAT_TIER_PRICE. */
export const FLAT_TIER_MAX_COMMUNITIES = 3;
export const FLAT_TIER_PRICE = 299;
export const MIN_COMMUNITIES = 1;
export const MAX_COMMUNITIES = 300;

/**
 * Free live inspections per signed-in account before subscription is required
 * (when Stripe is configured). Exactly one - not per day, not unlimited demo.
 */
export const FREE_TRIAL_INSPECTIONS = 1;

/** Raw volume curve without flat band: round(99 × c^0.7). */
export function volumePriceForCommunities(communities: number): number {
  const c = clampCommunities(communities);
  return Math.round(PRICING_BASE * Math.pow(c, PRICING_EXPONENT));
}

/** Monthly price in whole dollars for `c` communities (published table). */
export function priceForCommunities(communities: number): number {
  const c = clampCommunities(communities);
  if (c <= FLAT_TIER_MAX_COMMUNITIES) return FLAT_TIER_PRICE;
  return Math.max(FLAT_TIER_PRICE, volumePriceForCommunities(c));
}

/**
 * Price when increasing communities on an existing subscription.
 * Same published table as initial purchase; never below current monthly.
 */
export function upsellPriceForCommunities(
  toCommunities: number,
  currentPriceMonthly: number
): number {
  const table = priceForCommunities(toCommunities);
  const current = Math.max(0, Math.round(currentPriceMonthly));
  return Math.max(current, table);
}

export function formatPriceMonthly(amount: number): string {
  return `$${amount}/mo`;
}

/** Short formula copy for UI (ASCII hyphens only). */
export function pricingFormulaLabel(): string {
  return `$${FLAT_TIER_PRICE}/mo for 1-${FLAT_TIER_MAX_COMMUNITIES} communities; above that max($${FLAT_TIER_PRICE}, round($${PRICING_BASE} × c^${PRICING_EXPONENT}))`;
}

export function clampCommunities(communities: number): number {
  if (!Number.isFinite(communities)) return MIN_COMMUNITIES;
  return Math.min(
    MAX_COMMUNITIES,
    Math.max(MIN_COMMUNITIES, Math.round(communities))
  );
}

/** Sample table for pricing page / docs. */
export function pricingSamples(
  counts: number[] = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
): {
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

/** @deprecated Legacy dual-plan labels - community formula is the live model. */
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
