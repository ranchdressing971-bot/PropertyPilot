import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCheckoutButton } from "@/components/pricing/PricingCheckoutButton";
import { Check } from "lucide-react";
import { FREE_TRIAL_INSPECTIONS } from "@/lib/stripe";

const starterFeatures = [
  "Up to 50 homes per inspection",
  "AI drive-through inspections",
  "Automatic address discovery",
  "Violation review & PDF notices",
  "CC&R rule configuration",
  "Email support",
];

const professionalFeatures = [
  "Unlimited homes per inspection",
  "Everything in Starter",
  "Priority AI processing",
  "Advanced compliance reports",
  "Audit log export",
  "Priority email support",
];

export const metadata = {
  title: "Pricing — Property Pilot",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900">
          Simple pricing for every HOA
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Demo mode is always free. Live AI inspections start with{" "}
          {FREE_TRIAL_INSPECTIONS} free inspections — then choose a plan.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="surface p-8 text-left">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
              {FREE_TRIAL_INSPECTIONS} free inspections to start
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-ink-900">Starter</h2>
            <p className="mt-1 text-sm text-ink-500">
              For smaller communities and pilot programs
            </p>
            <p className="mt-6 text-4xl font-semibold tracking-tight text-ink-900">
              $149
              <span className="text-base font-normal text-ink-400">/month</span>
            </p>
            <ul className="mt-8 space-y-3">
              {starterFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PricingCheckoutButton
                plan="starter"
                label={`Subscribe — ${FREE_TRIAL_INSPECTIONS} inspections free first`}
              />
            </div>
          </div>

          <div className="surface p-8 text-left ring-2 ring-brand-500/25">
            <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white">
              Most popular
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-ink-900">Professional</h2>
            <p className="mt-1 text-sm text-ink-500">
              For active HOA managers with larger communities
            </p>
            <p className="mt-6 text-4xl font-semibold tracking-tight text-ink-900">
              $299
              <span className="text-base font-normal text-ink-400">/month</span>
            </p>
            <ul className="mt-8 space-y-3">
              {professionalFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PricingCheckoutButton
                plan="professional"
                variant="secondary"
                label="Subscribe — Professional"
              />
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">
          No card required until you subscribe. Cancel anytime in Settings.
        </p>

        <p className="mt-6 text-xs text-ink-400">
          Secure billing via Stripe. Questions?{" "}
          <a href="mailto:support@propertypilot.app" className="text-brand-600 hover:underline">
            support@propertypilot.app
          </a>
        </p>
      </section>
    </PublicLayout>
  );
}
