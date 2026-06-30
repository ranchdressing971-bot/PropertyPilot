import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCheckoutButton } from "@/components/pricing/PricingCheckoutButton";
import { Check } from "lucide-react";
import { FREE_TRIAL_SCANS } from "@/lib/stripe";

const features = [
  "Unlimited AI drive-through inspections",
  "Automatic address discovery from video",
  "Violation review, approve & dismiss",
  "PDF violation notices",
  "CC&R rule configuration",
  "Audit log & compliance reports",
  "Email support",
];

export const metadata = {
  title: "Pricing — Property Pilot",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
        <h1 className="font-display text-4xl font-semibold text-ink-900">
          One plan. Everything included.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Demo mode is always free. Live AI scans start with {FREE_TRIAL_SCANS} free
          inspections — then $149/month.
        </p>

        <div className="surface mx-auto mt-14 max-w-md p-8 text-left ring-2 ring-copper-400 ring-offset-2 ring-offset-canvas">
          <span className="rounded-md bg-copper-100 px-2 py-0.5 text-xs font-semibold text-copper-800">
            {FREE_TRIAL_SCANS} free scans to start
          </span>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink-900">
            Property Pilot
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            For HOA managers and community associations
          </p>
          <p className="mt-6 font-display text-4xl font-bold text-ink-900">
            $149
            <span className="text-base font-normal text-ink-400">/month</span>
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <PricingCheckoutButton label={`Subscribe — ${FREE_TRIAL_SCANS} scans free first`} />
          </div>
          <p className="mt-4 text-center text-xs text-ink-400">
            No card required until you subscribe. Cancel anytime in Settings.
          </p>
        </div>

        <p className="mt-10 text-xs text-ink-400">
          Secure billing via Stripe. Questions?{" "}
          <a href="mailto:support@propertypilot.app" className="underline">
            support@propertypilot.app
          </a>
        </p>
      </section>
    </PublicLayout>
  );
}
