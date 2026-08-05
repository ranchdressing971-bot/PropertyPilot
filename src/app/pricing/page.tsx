import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import {
  FREE_TRIAL_INSPECTIONS,
  FLAT_TIER_MAX_COMMUNITIES,
  FLAT_TIER_PRICE,
  PRICING_BASE,
  PRICING_EXPONENT,
} from "@/lib/stripe-client";

export const metadata = {
  title: "Pricing: RideBy",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-900">
          Pricing for every HOA you run
        </h1>
        <ul className="mx-auto mt-4 max-w-md list-disc space-y-1 pl-5 text-left text-ink-500">
          <li>
            {FREE_TRIAL_INSPECTIONS === 1
              ? "1 free inspection"
              : `${FREE_TRIAL_INSPECTIONS} free inspections`}{" "}
            + 1 community on trial
          </li>
          <li>
            From{" "}
            <span className="font-medium text-ink-700">
              ${FLAT_TIER_PRICE}/mo for 1-{FLAT_TIER_MAX_COMMUNITIES} communities
            </span>
          </li>
          <li>
            Above that: max(${FLAT_TIER_PRICE}, round(${PRICING_BASE} × c
            <sup>{PRICING_EXPONENT}</sup>))
          </li>
          <li>Add communities later in Settings</li>
        </ul>

        <div className="mt-14">
          <PricingCalculator />
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">
          No card required until you subscribe. Cancel anytime in Settings.
        </p>

        <p className="mt-6 text-xs text-ink-400">
          Secure billing via Stripe.
        </p>
      </section>
    </PublicLayout>
  );
}
