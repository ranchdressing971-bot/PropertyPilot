import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import { FREE_TRIAL_INSPECTIONS } from "@/lib/stripe-client";

export const metadata = {
  title: "Pricing — RideBy",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-900">
          Pricing that shrinks as you grow
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Live AI starts with {FREE_TRIAL_INSPECTIONS} free inspections per
          community. Then pay monthly by how many communities you manage —
          not a one-size sticker price.
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
