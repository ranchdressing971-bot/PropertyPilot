import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import {
  FREE_TRIAL_INSPECTIONS,
  FLAT_TIER_MAX_COMMUNITIES,
  FLAT_TIER_PRICE,
} from "@/lib/stripe-client";

export const metadata = {
  title: "Pricing: RideBy",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-5 py-14 text-center sm:py-20">
        <p className="page-eyebrow">Simple pricing</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink-900 sm:text-[2.75rem]">
          Pricing for every HOA you run
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-ink-500">
          {FREE_TRIAL_INSPECTIONS === 1
            ? "1 free inspection"
            : `${FREE_TRIAL_INSPECTIONS} free inspections`}{" "}
          to start. Then ${FLAT_TIER_PRICE}/mo for 1-{FLAT_TIER_MAX_COMMUNITIES}{" "}
          communities. Add more anytime.
        </p>

        <div className="mt-12">
          <PricingCalculator />
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">
          No card until you subscribe · Cancel in Settings · Stripe billing
        </p>
      </section>
    </PublicLayout>
  );
}
