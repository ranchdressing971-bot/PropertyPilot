"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  FREE_TRIAL_INSPECTIONS,
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  pricingSamples,
  MAX_COMMUNITIES,
  MIN_COMMUNITIES,
} from "@/lib/stripe-client";
import { Check, Minus, Plus } from "lucide-react";

const FEATURES = [
  "AI drive-through inspections",
  "Mailbox address matching",
  "Evidence frames + human review",
  "Violation notices (you approve)",
  "Community roster import",
  "Cancel anytime",
];

export function PricingCalculator() {
  const router = useRouter();
  const [communities, setCommunities] = useState(1);
  const price = useMemo(
    () => priceForCommunities(communities),
    [communities]
  );
  const samples = useMemo(() => pricingSamples([1, 2, 3, 5, 10]), []);

  function setCount(next: number) {
    setCommunities(clampCommunities(next));
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="surface p-8 text-left">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
          {FREE_TRIAL_INSPECTIONS} free inspections per community
        </span>

        <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">
          Pay for the communities you manage
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          Price scales with volume — not a flat jump every time you add an HOA.
          Formula: $99 × communities<sup>0.7</sup>
        </p>

        <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-ink-50/70 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Communities
            </p>
            <p className="mt-1 text-sm text-ink-600">
              How many HOAs will you run on RideBy?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer communities"
              onClick={() => setCount(communities - 1)}
              disabled={communities <= MIN_COMMUNITIES}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={MIN_COMMUNITIES}
              max={MAX_COMMUNITIES}
              value={communities}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-10 w-16 rounded-xl border border-ink-200 bg-white text-center text-base font-semibold text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              aria-label="More communities"
              onClick={() => setCount(communities + 1)}
              disabled={communities >= MAX_COMMUNITIES}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-5xl font-semibold tracking-tight text-ink-900">
            ${price}
            <span className="text-base font-normal text-ink-400">/month</span>
          </p>
          <p className="mt-2 text-sm text-ink-500">
            {communities === 1
              ? "1 community"
              : `${communities} communities`}{" "}
            · billed monthly · cancel anytime
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              router.push(`/pricing/checkout?communities=${communities}`)
            }
          >
            Subscribe — {formatPriceMonthly(price)}
          </Button>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Example pricing
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50/80 text-ink-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Communities</th>
              <th className="px-4 py-2.5 font-medium">Monthly</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                Per community
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {samples.map((row) => (
              <tr
                key={row.communities}
                className={
                  row.communities === communities ? "bg-brand-50/50" : undefined
                }
              >
                <td className="px-4 py-2.5 text-ink-900">{row.communities}</td>
                <td className="px-4 py-2.5 font-medium text-ink-900">
                  {row.priceLabel}
                </td>
                <td className="hidden px-4 py-2.5 text-ink-500 sm:table-cell">
                  ${Math.round(row.priceMonthly / row.communities)}/ea
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
