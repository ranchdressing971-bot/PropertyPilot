/** Client-safe Stripe plan constants (no secret key imports). */
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
