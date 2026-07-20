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
import { CheckCircle2, AlertTriangle, MapPin, History, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  formatCollectionDays,
  loadCollectionDays,
  shouldEnforceTrashBins,
} from "@/lib/trash-collection";

type FilterTab = "violations" | "all" | "clean" | "review" | "prior";

interface InspectionData extends InspectionDisplayData {
  trashScheduleNote?: string;
}

export function InspectionResultsView({ id }: { id: string }) {
  const [data, setData] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("violations");
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = getCachedInspectionClient(id);
      if (cached) {
        setData(cached);
        setLoading(false);
      }

      try {
        const days = loadCollectionDays();
        const qs = `?collectionDays=${encodeURIComponent(days.join(","))}`;
        const r = await fetch(`/api/inspection/${id}${qs}`, {
          credentials: "include",
        });
        if (!r.ok) {
          if (cached) return;
          throw new Error("Inspection not found");
        }
        const json = await r.json();
        if (!cancelled) {
          setData(json);
          setScheduleNote(
            json.trashScheduleNote ??
              (shouldEnforceTrashBins(days)
                ? `Trash bins can be flagged today (pickup: ${formatCollectionDays(days)}).`
                : `Today is a pickup day (${formatCollectionDays(days)}) — trash bins not flagged.`)
          );
        }
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

  function handleAddressConfirmed(propertyId: string, address: string) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        addressReviews: (prev.addressReviews ?? []).map((r) =>
          r.propertyId === propertyId
            ? { ...r, address, confidence: 100, needsReview: false }
            : r
        ),
        results: prev.results.map((r) =>
          r.propertyId === propertyId
            ? {
                ...r,
                property: {
                  ...r.property,
                  address,
                  needsAddressReview: false,
                  addressConfidence: 100,
                },
              }
            : r
        ),
      };
    });
  }

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
        {scheduleNote && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-4 flex items-start gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700 shadow-sm"
          >
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
            <p className="text-xs leading-relaxed sm:text-sm">{scheduleNote}</p>
          </motion.div>
        )}

        {addressReviewItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, type: "spring", stiffness: 400, damping: 28 }}
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
                  Open the <span className="font-medium">Needs review</span> tab —
                  check the photo, then tap Looks right or Fix number.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 360, damping: 28 }}
          className="grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4"
        >
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mt-5 flex gap-1.5 overflow-x-auto pb-1"
        >
          {tabs.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              layout
              whileTap={{ scale: 0.96 }}
              onClick={() => setTab(t.id)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-ink-900 text-white shadow-sm"
                  : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
              )}
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{t.count}</span>
            </motion.button>
          ))}
        </motion.div>

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
                  onAddressConfirmed={handleAddressConfirmed}
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
