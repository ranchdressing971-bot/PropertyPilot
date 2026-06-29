"use client";

import { Card } from "@/components/ui/Card";

interface AIInsightsProps {
  insights: {
    mostCommonViolation: string;
    avgInspectionTime: string;
    complianceScore: number;
    repeatOffenders: { address: string; count: number }[];
  };
  empty?: boolean;
}

export function AIInsights({ insights, empty }: AIInsightsProps) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-ink-900">
        Insights
      </h3>

      {empty ? (
        <p className="mt-3 text-sm text-ink-500">
          Run an inspection to see compliance trends.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InsightCell label="Top violation" value={insights.mostCommonViolation} />
          <InsightCell label="Avg scan time" value={insights.avgInspectionTime} />
          <div className="rounded-lg bg-ink-50 p-3.5 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Compliance
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-ink-900">
                {insights.complianceScore}%
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-copper-500 transition-all"
                style={{ width: `${insights.complianceScore}%` }}
              />
            </div>
          </div>
          {insights.repeatOffenders.length > 0 && (
            <div className="rounded-lg bg-ink-50 p-3.5 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Repeat flags
              </p>
              <ul className="mt-2 space-y-1.5">
                {insights.repeatOffenders.slice(0, 3).map((o) => (
                  <li key={o.address} className="flex justify-between text-sm">
                    <span className="text-ink-700">{o.address}</span>
                    <span className="font-medium text-copper-700">{o.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function InsightCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 p-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}
