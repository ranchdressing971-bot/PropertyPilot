"use client";

import { PageContent } from "@/components/layout/PageContent";
import { ViolationCard } from "@/components/violations/ViolationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { violations as demoViolations } from "@/lib/mock-data";
import { AlertTriangle, Loader2 } from "lucide-react";

export function ViolationsPageContent() {
  const { isDemo, isLive } = useAppMode();
  const { data: live, loading } = useLiveDashboard(isLive);

  const violations = isDemo ? demoViolations : (live?.violations ?? []);
  const pending = violations.filter((v) => v.status === "pending");
  const reviewed = violations.filter((v) => v.status !== "pending");

  if (isLive && loading && !live) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  if (isLive && violations.length === 0) {
    return (
      <PageContent>
        <EmptyState
          icon={AlertTriangle}
          title="No violations flagged"
          description="When AI detects compliance issues during a scan, they'll show up here for your review."
        />
      </PageContent>
    );
  }

  return (
    <PageContent>
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Pending review
          </h2>
          <div className="space-y-3">
            {pending.map((v, i) => (
              <ViolationCard key={v.id} violation={v} index={i} />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Reviewed
          </h2>
          <div className="space-y-3">
            {reviewed.map((v, i) => (
              <ViolationCard key={v.id} violation={v} index={i} />
            ))}
          </div>
        </section>
      )}
    </PageContent>
  );
}

export function getViolationsSubtitle(isDemo: boolean, pending: number, total: number) {
  if (isDemo) return `${pending} pending · ${total} total`;
  if (total === 0) return "Flags from your scans";
  return `${pending} pending · ${total} total`;
}
