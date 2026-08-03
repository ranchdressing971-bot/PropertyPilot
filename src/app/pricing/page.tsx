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
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Live AI starts with{" "}
          {FREE_TRIAL_INSPECTIONS === 1
            ? "1 free inspection per account"
            : `${FREE_TRIAL_INSPECTIONS} free inspections per account`}{" "}
          and 1 community on trial. Subscribe from{" "}
          <span className="font-medium text-ink-700">
            ${FLAT_TIER_PRICE}/mo for 1-{FLAT_TIER_MAX_COMMUNITIES} communities
          </span>
          . Need more? Price follows max(${FLAT_TIER_PRICE}, round($
          {PRICING_BASE} × c<sup>{PRICING_EXPONENT}</sup>)). Each community keeps
          that HOA&apos;s inspections and properties organized under one org
          account. Add seats later in Settings.

        </p>

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
