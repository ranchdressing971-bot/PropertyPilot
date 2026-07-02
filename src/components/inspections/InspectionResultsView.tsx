"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { InspectionResultCard } from "@/components/inspections/InspectionResultCard";
import type { InspectionDisplayData } from "@/lib/inspection-display";
import { getCachedInspectionClient } from "@/lib/inspection-cache";
import { CheckCircle2, AlertTriangle, Sparkles, Loader2, MapPin } from "lucide-react";

interface InspectionData extends InspectionDisplayData {}

export function InspectionResultsView({ id }: { id: string }) {
  const [data, setData] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <DashboardLayout>
        <Header title="Loading..." />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <Header title="Inspection Not Found" />
        <PageContent className="text-center text-slate-500">
          <p>{error ?? "Not found"}</p>
          <Link href="/dashboard/inspections" className="mt-4 inline-block text-accent-600">
            Back to inspections
          </Link>
        </PageContent>
      </DashboardLayout>
    );
  }

  const withViolations = data.results.filter((r) => r.violation);
  const clean = data.results.filter((r) => !r.violation);
  const fromMeta = data.addressReviews?.filter((r) => r.needsReview) ?? [];
  const addressReviewItems =
    fromMeta.length > 0
      ? fromMeta
      : data.results
          .filter((r) => r.property.needsAddressReview)
          .map((r) => ({
            propertyId: r.propertyId,
            address: r.property.address,
            confidence: r.property.addressConfidence ?? 0,
            needsReview: true,
          }));

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
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">
                  {addressReviewItems.length} address
                  {addressReviewItems.length === 1 ? "" : "es"} need confirmation
                </p>
                <p className="mt-1 text-xs text-amber-800/90">
                  GPS and mailbox reads were uncertain — confirm the address before
                  sending violation notices.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {data.aiPowered && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col gap-1 rounded-xl border border-accent-200/60 bg-accent-50/80 px-4 py-3 text-sm text-accent-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              {data.usedVideoFrames
                ? "Analyzed from your uploaded video"
                : "AI-generated analysis"}
            </div>
            {data.usedVideoFrames && (
              <span className="text-xs text-accent-700/80">
                {data.propertiesScanned ?? data.results.length} new homes ·{" "}
                {data.frameCount ?? 0} frames
                {data.usedGpsPipeline ? " · GPS-assisted matching" : ""}
                {(data.previouslyInspectedCount ?? 0) > 0
                  ? ` · ${data.previouslyInspectedCount} already inspected`
                  : ""}
              </span>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <Card padding="sm" className="flex items-center gap-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-medium text-slate-500">Clean</p>
              <p className="text-xl font-semibold">{clean.length}</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-medium text-slate-500">Violations</p>
              <p className="text-xl font-semibold">{withViolations.length}</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.results.map((result, i) => {
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
          })}
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
