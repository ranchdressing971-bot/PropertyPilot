"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GoodPropertyReport } from "@/components/reports/GoodPropertyReport";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { getPropertyFromCachedInspection } from "@/lib/inspection-cache";
import {
  getProperty,
  getPropertyViolations,
  inspections,
  Property,
  Violation,
} from "@/lib/mock-data";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Home,
} from "lucide-react";

interface PropertyDetailPageClientProps {
  id: string;
  inspectionId?: string;
}

function isSupabaseStorageUrl(src: string): boolean {
  return src.includes("supabase.co/storage/");
}

function PropertyPhoto({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-50">
        <Home className="h-12 w-12 text-ink-200" />
      </div>
    );
  }

  if (src.startsWith("data:") || isSupabaseStorageUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    );
  }

  return <Image src={src} alt={alt} fill className="object-cover" unoptimized />;
}

export function PropertyDetailPageClient({
  id,
  inspectionId,
}: PropertyDetailPageClientProps) {
  const { isDemo } = useAppMode();
  const { data: live, loading, refresh } = useLiveDashboard(!isDemo);
  const [inspectionProperty, setInspectionProperty] = useState<Property | null>(null);
  const [inspectionViolations, setInspectionViolations] = useState<Violation[]>([]);
  const [loadingInspection, setLoadingInspection] = useState(Boolean(inspectionId && !isDemo));

  useEffect(() => {
    if (!isDemo) void refresh();
  }, [isDemo, refresh]);

  useEffect(() => {
    if (isDemo || !inspectionId) return;

    let cancelled = false;

    async function loadFromInspection() {
      const cached = getPropertyFromCachedInspection(inspectionId!, id);
      if (cached && !cancelled) {
        setInspectionProperty(cached.property);
        setInspectionViolations(cached.violation ? [cached.violation] : []);
        setLoadingInspection(false);
      }

      try {
        const r = await fetch(`/api/inspection/${inspectionId}`, {
          credentials: "include",
        });
        if (!r.ok || cancelled) return;

        const data = await r.json();
        const match = data.results?.find(
          (row: { propertyId: string }) => row.propertyId === id
        );
        if (match?.property && !cancelled) {
          setInspectionProperty(match.property);
          setInspectionViolations(match.violation ? [match.violation] : []);
        }
      } finally {
        if (!cancelled) setLoadingInspection(false);
      }
    }

    void loadFromInspection();
    return () => {
      cancelled = true;
    };
  }, [inspectionId, id, isDemo]);

  const property: Property | undefined = isDemo
    ? getProperty(id)
    : (inspectionProperty ?? live?.properties.find((p) => p.id === id));

  const propertyViolations = isDemo
    ? getPropertyViolations(id)
    : inspectionViolations.length > 0
      ? inspectionViolations
      : (live?.violations.filter((v) => v.propertyId === id) ?? []);

  const propertyInspections = isDemo
    ? inspections
    : (live?.inspections.filter((i) =>
        i.results.some((r) => r.propertyId === id)
      ) ?? []);

  if (loadingInspection || (loading && !isDemo && !property)) {
    return (
      <DashboardLayout>
        <Header title="Loading..." />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!property) {
    return (
      <DashboardLayout>
        <Header title="Not found" />
        <PageContent>
          <p className="text-sm text-ink-500">This property isn&apos;t in your data.</p>
          {inspectionId && (
            <Link
              href={`/dashboard/inspections/${inspectionId}`}
              className="mt-4 inline-block text-sm text-accent-600"
            >
              Back to inspection results
            </Link>
          )}
        </PageContent>
      </DashboardLayout>
    );
  }

  const hasViolations = propertyViolations.length > 0;

  return (
    <DashboardLayout>
      <Header title={property.address} subtitle={property.neighborhood} />
      <PageContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <div className="relative h-52 w-full sm:h-64">
                <PropertyPhoto src={property.image} alt={property.address} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink-900">
                      {property.address}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {property.neighborhood}
                    </p>
                  </div>
                  <Badge status={property.status} />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-sm font-semibold text-ink-900">
                Inspection history
              </h3>
              {propertyInspections.length === 0 && !inspectionId ? (
                <p className="mt-3 text-sm text-ink-500">No inspections yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {inspectionId && propertyInspections.length === 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-ink-400" />
                        <p className="text-sm font-medium text-ink-900">Current inspection</p>
                      </div>
                      <Link href={`/dashboard/inspections/${inspectionId}`}>
                        <Button variant="ghost" size="sm">
                          View
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  )}
                  {propertyInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-ink-400" />
                        <div>
                          <p className="text-sm font-medium text-ink-900">{insp.name}</p>
                          <p className="text-xs text-ink-500">{insp.date}</p>
                        </div>
                      </div>
                      <Link href={`/dashboard/inspections/${insp.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-display text-sm font-semibold text-ink-900">
                Violation timeline
              </h3>
              {hasViolations ? (
                <div className="mt-4 space-y-4">
                  {propertyViolations.map((v) => (
                    <div
                      key={v.id}
                      className="border-l-2 border-copper-300 pl-4"
                    >
                      <p className="text-sm font-medium text-ink-900">{v.type}</p>
                      <p className="text-xs text-ink-500">
                        {new Date(v.detectedAt).toLocaleDateString()} · {v.confidence}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No violations on record
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <h3 className="font-display text-sm font-semibold text-ink-900">Status</h3>
              <div className="mt-3">
                <Badge status={property.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-500">Last inspection</span>
                  <span className="font-medium">{property.lastInspection}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Violations</span>
                  <span className="font-medium">{propertyViolations.length}</span>
                </div>
              </div>
            </Card>

            {!hasViolations && <GoodPropertyReport property={property} />}

            {hasViolations && (
              <Card>
                <div className="flex items-center gap-2 text-copper-700">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="font-display text-sm font-semibold">Active flags</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {propertyViolations.map((v) => (
                    <Link
                      key={v.id}
                      href={`/dashboard/violations/${v.id}`}
                      className="block rounded-lg border border-copper-100 bg-copper-50/50 px-3 py-2.5 transition-colors hover:bg-copper-50"
                    >
                      <p className="text-sm font-medium text-ink-900">{v.type}</p>
                      <p className="text-xs text-ink-500">{v.confidence}% confidence</p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
