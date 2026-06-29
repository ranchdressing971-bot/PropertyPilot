import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { aiInsights, inspections, properties } from "@/lib/mock-data";
import { Download, FileText, BarChart3, Award } from "lucide-react";

export default function ReportsPage() {
  const cleanCount = properties.filter((p) => p.status === "Good Standing").length;

  return (
    <DashboardLayout>
      <Header title="Reports" subtitle="Compliance reports and exports" />
      <PageContent>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card hover>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50">
              <BarChart3 className="h-5 w-5 text-accent-600" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Monthly Compliance Report
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Neighborhood-wide compliance score: {aiInsights.complianceScore}%.
              {inspections.length} inspections this quarter.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </Card>

          <Card hover>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <Award className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Good Property Reports
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {cleanCount} properties in good standing. Generate recognition
              reports for compliant homeowners.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              <Download className="h-4 w-4" />
              Bulk Export
            </Button>
          </Card>

          <Card hover>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              Violation Summary
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Most common: {aiInsights.mostCommonViolation}.{" "}
              {aiInsights.repeatOffenders.length} repeat offenders identified.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </Card>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
