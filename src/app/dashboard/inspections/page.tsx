import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { inspections } from "@/lib/mock-data";
import { Video, Upload, ArrowRight, Calendar } from "lucide-react";

export default function InspectionsPage() {
  return (
    <DashboardLayout>
      <Header title="Inspections" subtitle="All neighborhood drive-through inspections" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex justify-end">
          <Link href="/dashboard/inspections/upload">
            <Button>
              <Upload className="h-4 w-4" />
              New Inspection
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {inspections.map((inspection) => (
            <Card key={inspection.id} hover className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50">
                  <Video className="h-6 w-6 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{inspection.name}</h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {inspection.date}
                    </span>
                    <span>{inspection.neighborhood}</span>
                    <span>{inspection.propertiesScanned} properties</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <Badge status={inspection.status === "completed" ? "Good Standing" : "Needs Review"} />
                  <p className="mt-1 text-sm text-slate-500">
                    {inspection.violationsFound} violations found
                  </p>
                </div>
                <Link href={`/dashboard/inspections/${inspection.id}`}>
                  <Button variant="secondary" size="sm">
                    View Results
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
