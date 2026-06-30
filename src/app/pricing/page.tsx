import Link from "next/link";
import { HomeLogo } from "@/components/brand/HomeLogo";
import { Button } from "@/components/ui/Button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
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
    <div className="min-h-screen bg-canvas dark:bg-ink-950">
      <nav className="border-b border-ink-200/80 px-5 py-4 dark:border-ink-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <HomeLogo size="sm" href="/" />
          <Link href="/login">
            <Button size="sm" variant="secondary">
              Sign in
            </Button>
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-24">
        <h1 className="font-display text-4xl font-semibold text-ink-900 dark:text-ink-50">
          Simple pricing for every community
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500 dark:text-ink-400">
          Start with a demo, then upgrade when you&apos;re ready for live AI scans.
          All plans include a 14-day trial.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 text-left ${
                plan.featured
                  ? "border-copper-400 bg-white shadow-lg dark:border-copper-600 dark:bg-ink-900"
                  : "border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900/50"
              }`}
            >
              {plan.featured && (
                <span className="rounded-md bg-copper-100 px-2 py-0.5 text-xs font-semibold text-copper-800">
                  Most popular
                </span>
              )}
              <h2 className="mt-2 font-display text-xl font-semibold text-ink-900 dark:text-ink-100">
                {plan.name}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{plan.desc}</p>
              <p className="mt-4 font-display text-3xl font-bold text-ink-900 dark:text-ink-50">
                {plan.price}
                <span className="text-base font-normal text-ink-400">{plan.period}</span>
              </p>
              <ul className="mt-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-600 dark:text-ink-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6 block">
                <Button
                  className="w-full"
                  variant={plan.featured ? "primary" : "secondary"}
                >
                  {plan.price === "Custom" ? "Contact sales" : "Start free trial"}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-ink-400">
          Billing via Stripe coming soon. Demo mode is always free.
        </p>
      </section>

      <footer className="border-t border-ink-200/80 py-6 text-center text-xs text-ink-400 dark:border-ink-800">
        <Link href="/" className="hover:underline">
          ← Back to home
        </Link>
      </footer>
    </div>
  );
}
