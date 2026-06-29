import Image from "next/image";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GoodPropertyReport } from "@/components/reports/GoodPropertyReport";
import {
  getProperty,
  getPropertyViolations,
  inspections,
} from "@/lib/mock-data";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const property = getProperty(id);

  if (!property) {
    return (
      <DashboardLayout>
        <Header title="Property Not Found" />
        <div className="p-8 text-center text-slate-500">Property not found.</div>
      </DashboardLayout>
    );
  }

  const propertyViolations = getPropertyViolations(property.id);
  const hasViolations = propertyViolations.length > 0;

  return (
    <DashboardLayout>
      <Header title={property.address} subtitle={property.neighborhood} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="overflow-hidden p-0">
              <div className="relative h-64 w-full">
                <Image
                  src={property.image}
                  alt={property.address}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {property.address}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" />
                      {property.neighborhood}
                    </p>
                  </div>
                  <Badge status={property.status} />
                </div>
              </div>
            </Card>

            {/* Inspection History */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">
                Inspection History
              </h3>
              <div className="mt-4 space-y-3">
                {inspections.map((insp) => (
                  <div
                    key={insp.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {insp.name}
                        </p>
                        <p className="text-xs text-slate-500">{insp.date}</p>
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
            </Card>

            {/* Violation Timeline */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">
                Violation Timeline
              </h3>
              {hasViolations ? (
                <div className="mt-4 space-y-4">
                  {propertyViolations.map((v) => (
                    <div
                      key={v.id}
                      className="relative border-l-2 border-amber-200 pl-4"
                    >
                      <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-amber-400" />
                      <p className="text-sm font-medium text-slate-900">
                        {v.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        Detected {new Date(v.detectedAt).toLocaleDateString()} ·{" "}
                        {v.confidence}% confidence
                      </p>
                      <Badge status={v.status} className="mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  No violations on record
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Status</h3>
              <div className="mt-3">
                <Badge status={property.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Inspection</span>
                  <span className="font-medium">{property.lastInspection}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Violations</span>
                  <span className="font-medium">{propertyViolations.length}</span>
                </div>
              </div>
            </Card>

            {!hasViolations && <GoodPropertyReport property={property} />}

            {hasViolations && (
              <Card>
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-sm font-semibold">Active Violations</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {propertyViolations.map((v) => (
                    <Link
                      key={v.id}
                      href={`/dashboard/violations/${v.id}`}
                      className="block rounded-lg bg-amber-50 p-3 transition-colors hover:bg-amber-100"
                    >
                      <p className="text-sm font-medium text-amber-900">
                        {v.type}
                      </p>
                      <p className="text-xs text-amber-700">
                        {v.confidence}% confidence
                      </p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
