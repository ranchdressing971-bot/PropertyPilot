"use client";

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
import {
  getProperty,
  getPropertyViolations,
  inspections,
  Property,
} from "@/lib/mock-data";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface PropertyDetailPageClientProps {
  id: string;
}

export function PropertyDetailPageClient({ id }: PropertyDetailPageClientProps) {
  const { isDemo } = useAppMode();
  const { data: live } = useLiveDashboard(!isDemo);

  const property: Property | undefined = isDemo
    ? getProperty(id)
    : live?.properties.find((p) => p.id === id);

  const propertyViolations = isDemo
    ? getPropertyViolations(id)
    : (live?.violations.filter((v) => v.propertyId === id) ?? []);

  const propertyInspections = isDemo
    ? inspections
    : (live?.inspections.filter((i) =>
        i.results.some((r) => r.propertyId === id)
      ) ?? []);

  if (!property) {
    return (
      <DashboardLayout>
        <Header title="Not found" />
        <PageContent>
          <p className="text-sm text-ink-500">This property isn&apos;t in your data.</p>
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
              {property.image ? (
                <div className="relative h-52 w-full sm:h-64">
                  <Image
                    src={property.image}
                    alt={property.address}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-52 items-center justify-center bg-ink-50 sm:h-64">
                  <span className="font-display text-4xl font-semibold text-ink-200">
                    {property.address.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
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
              {propertyInspections.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">No scans yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
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
                  <span className="text-ink-500">Last scan</span>
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
