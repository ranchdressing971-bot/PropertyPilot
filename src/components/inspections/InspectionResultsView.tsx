"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { InspectionResultCard } from "@/components/inspections/InspectionResultCard";
import type { InspectionDisplayData } from "@/lib/inspection-display";
import { getCachedInspectionClient } from "@/lib/inspection-cache";
import { CheckCircle2, AlertTriangle, MapPin, History } from "lucide-react";
import clsx from "clsx";

type FilterTab = "violations" | "all" | "clean" | "review" | "prior";

interface InspectionData extends InspectionDisplayData {}

export function InspectionResultsView({ id }: { id: string }) {
  const [data, setData] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("violations");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = getCachedInspectionClient(id);
      if (cached) {
        setData(cached);
        setLoading(false);
      }

      try {
        const r = await fetch(`/api/inspection/${id}`, { credentials: "include" });
        if (!r.ok) {
          if (cached) return;
          throw new Error("Inspection not found");
        }
        const json = await r.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cached && !cancelled) {
          setError(e instanceof Error ? e.message : "Inspection not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const withViolations = useMemo(
    () => data?.results.filter((r) => r.violation) ?? [],
    [data]
  );
  const clean = useMemo(
    () => data?.results.filter((r) => !r.violation && !r.property.previouslyInspected) ?? [],
    [data]
  );
  const prior = useMemo(
    () => data?.results.filter((r) => r.property.previouslyInspected) ?? [],
    [data]
  );
  const addressReviewItems = useMemo(() => {
    if (!data) return [];
    const fromMeta = data.addressReviews?.filter((r) => r.needsReview) ?? [];
    if (fromMeta.length > 0) return fromMeta;
    return data.results
      .filter((r) => r.property.needsAddressReview)
      .map((r) => ({
        propertyId: r.propertyId,
        address: r.property.address,
        confidence: r.property.addressConfidence ?? 0,
        needsReview: true,
      }));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    switch (tab) {
      case "violations":
        return data.results.filter((r) => r.violation);
      case "clean":
        return data.results.filter(
          (r) => !r.violation && !r.property.previouslyInspected && !r.property.needsAddressReview
        );
      case "review":
        return data.results.filter((r) => r.property.needsAddressReview);
      case "prior":
        return data.results.filter((r) => r.property.previouslyInspected);
      default:
        return data.results;
    }
  }, [data, tab]);

  if (loading) {
    return (
      <DashboardLayout>
        <Header title="Loading..." />
        <PageContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </PageContent>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <Header title="Inspection" />
        <PageContent>
          <ErrorState
            title="Inspection not found"
            message={error ?? "This inspection may have expired or been removed."}
            actionLabel="Back to inspections"
            actionHref="/dashboard/inspections"
          />
        </PageContent>
      </DashboardLayout>
    );
  }

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "violations", label: "Violations", count: withViolations.length },
    { id: "all", label: "All", count: data.results.length },
    { id: "clean", label: "Clean", count: clean.length },
    { id: "review", label: "Needs review", count: addressReviewItems.length },
    { id: "prior", label: "Already inspected", count: prior.length },
  ];

  return (
    <DashboardLayout>
      <Header
        title={data.name}
        subtitle={`${data.date} · ${withViolations.length} violations · ${clean.length} clean`}
      />
      <PageContent>
        {addressReviewItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">
                  {addressReviewItems.length} address
                  {addressReviewItems.length === 1 ? "" : "es"} need confirmation
                </p>
                <p className="mt-1 text-xs text-amber-800/90">
                  Unverified homes were not turned into enforceable violations.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4">
          <Card padding="sm" className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <p className="text-xs font-medium text-ink-500">Clean</p>
              <p className="text-xl font-semibold text-ink-900">{clean.length}</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-medium text-ink-500">Violations</p>
              <p className="text-xl font-semibold text-ink-900">{withViolations.length}</p>
            </div>
          </Card>
        </div>

        <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-ink-900 text-white"
                  : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
              )}
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        {prior.length > 0 && tab === "all" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
            <History className="h-3.5 w-3.5" />
            {prior.length} home{prior.length === 1 ? "" : "s"} skipped as previously inspected
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-ink-500">
              Nothing in this filter.
            </p>
          ) : (
            filtered.map((result, i) => {
              if (!result.property) return null;
              return (
                <InspectionResultCard
                  key={result.propertyId}
                  inspectionId={data.id}
                  property={result.property}
                  violation={result.violation}
                  index={i}
                />
              );
            })
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard/inspections" className="text-sm text-brand-700 hover:underline">
            ← All inspections
          </Link>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
