import { PublicLayout } from "@/components/layout/PublicLayout";
import { PricingCheckoutButton } from "@/components/pricing/PricingCheckoutButton";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    plan: "starter" as const,
    price: "$49",
    period: "/month",
    desc: "Small communities up to 50 homes",
    features: [
      "5 AI inspections / month",
      "Property roster import",
      "Violation notice PDFs",
      "Email support",
    ],
  },
  {
    name: "Professional",
    plan: "professional" as const,
    price: "$129",
    period: "/month",
    desc: "Growing HOAs up to 200 homes",
    featured: true,
    features: [
      "Unlimited inspections",
      "Address recognition",
      "CC&R rule configuration",
      "Audit log & reports",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    plan: null,
    price: "Custom",
    period: "",
    desc: "Management companies & large communities",
    features: [
      "Multi-community dashboard",
      "SSO & custom branding",
      "Dedicated onboarding",
      "SLA & phone support",
    ],
  },
];

export const metadata = {
  title: "Pricing — Property Pilot",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
        <h1 className="font-display text-4xl font-semibold text-ink-900">
          Simple pricing for every community
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Demo is always free. Live AI scans include a 14-day trial — no card required until
          checkout.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`surface p-6 text-left ${
                plan.featured ? "ring-2 ring-copper-400 ring-offset-2 ring-offset-canvas" : ""
              }`}
            >
              {plan.featured && (
                <span className="rounded-md bg-copper-100 px-2 py-0.5 text-xs font-semibold text-copper-800">
                  Most popular
                </span>
              )}
              <h2 className="mt-2 font-display text-xl font-semibold text-ink-900">
                {plan.name}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{plan.desc}</p>
              <p className="mt-4 font-display text-3xl font-bold text-ink-900">
                {plan.price}
                <span className="text-base font-normal text-ink-400">{plan.period}</span>
              </p>
              <ul className="mt-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {plan.plan ? (
                  <PricingCheckoutButton
                    plan={plan.plan}
                    variant={plan.featured ? "primary" : "secondary"}
                    label="Start free trial"
                  />
                ) : (
                  <a
                    href="mailto:support@propertypilot.app?subject=Enterprise%20inquiry"
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Contact sales
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-ink-400">
          Secure billing via Stripe. Cancel anytime from Settings.
        </p>
      </section>
    </PublicLayout>
  );
}
