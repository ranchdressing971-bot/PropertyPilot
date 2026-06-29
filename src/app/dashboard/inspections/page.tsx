import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { inspections } from "@/lib/mock-data";
import { Video, Upload, ArrowRight, Calendar } from "lucide-react";

export default function InspectionsPage() {
  return (
    <DashboardLayout>
      <Header title="Inspections" subtitle="Neighborhood drive-through scans" />
      <PageContent>
        <div className="flex justify-stretch sm:justify-end">
          <Link href="/dashboard/inspections/upload" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Upload className="h-4 w-4" />
              New Inspection
            </Button>
          </Link>
        </div>

        <div className="space-y-5">
          {inspections.map((inspection) => (
            <Card key={inspection.id} hover>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-50">
                    <Video className="h-6 w-6 text-accent-600" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h3 className="text-base font-semibold leading-snug text-slate-900">
                      {inspection.name}
                    </h3>
                    <div className="flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-3">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {inspection.date}
                      </span>
                      <span>{inspection.neighborhood}</span>
                      <span>{inspection.propertiesScanned} properties</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:border-0 sm:pt-0">
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <Badge
                      status={
                        inspection.status === "completed"
                          ? "Good Standing"
                          : "Needs Review"
                      }
                    />
                    <p className="text-sm text-slate-500">
                      {inspection.violationsFound} violations
                    </p>
                  </div>
                  <Link href={`/dashboard/inspections/${inspection.id}`} className="w-full sm:w-auto">
                    <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                      View Results
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
