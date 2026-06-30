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
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900">
          One plan. Everything included.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Demo mode is always free. Live AI scans start with {FREE_TRIAL_SCANS} free
          inspections — then $149/month.
        </p>

        <div className="surface mx-auto mt-14 max-w-md p-8 text-left ring-2 ring-brand-500/20">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
            {FREE_TRIAL_SCANS} free scans to start
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-ink-900">Property Pilot</h2>
          <p className="mt-1 text-sm text-ink-500">
            For HOA managers and community associations
          </p>
          <p className="mt-6 text-4xl font-semibold tracking-tight text-ink-900">
            $149
            <span className="text-base font-normal text-ink-400">/month</span>
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
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
          <a href="mailto:support@propertypilot.app" className="text-brand-600 hover:underline">
            support@propertypilot.app
          </a>
        </p>
      </section>
    </PublicLayout>
  );
}
