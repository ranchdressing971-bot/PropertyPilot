"use client";

import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { aiInsights, inspections, properties } from "@/lib/mock-data";
import { Download, FileText, BarChart3, Award, Loader2 } from "lucide-react";
import { downloadComplianceReportPdf } from "@/lib/pdf-notice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { displayHoaName } from "@/lib/profile";
import { useToast } from "@/components/providers/ToastProvider";

export function ReportsPageContent() {
  const { isDemo, isLive } = useAppMode();
  const { data: live, loading } = useLiveDashboard(isLive);
  const { profile, isDemo: demoProfile } = useUserProfile();
  const { toast } = useToast();

  function exportPdf(
    opts: Parameters<typeof downloadComplianceReportPdf>[0]
  ) {
    downloadComplianceReportPdf(opts);
    toast("PDF downloaded");
  }

  const hasData = isDemo
    ? true
    : (live?.inspections.length ?? 0) > 0;

  const cleanCount = isDemo
    ? properties.filter((p) => p.status === "Good Standing").length
    : (live?.properties.filter((p) => p.status === "Good Standing").length ?? 0);

  const inspectionCount = isDemo ? inspections.length : (live?.inspections.length ?? 0);
  const compliance = isDemo
    ? aiInsights.complianceScore
    : (live?.insights?.complianceScore ?? 0);
  const topViolation = isDemo
    ? aiInsights.mostCommonViolation
    : (live?.insights?.mostCommonViolation ?? "—");
  const repeatCount = isDemo
    ? aiInsights.repeatOffenders.length
    : (live?.insights?.repeatOffenders.length ?? 0);

  if (isLive && loading && !live) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  if (isLive && !hasData) {
    return (
      <PageContent>
        <EmptyState
          icon={FileText}
          title="Reports unlock after your first inspection"
          description="Compliance summaries and exports are generated from your inspection data."
          actionLabel="Upload inspection"
        />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          icon={BarChart3}
          title="Compliance report"
          description={`Neighborhood score: ${compliance}%. ${inspectionCount} inspection${inspectionCount === 1 ? "" : "s"} on record.`}
          onExport={() =>
            exportPdf({
              hoaName: displayHoaName(profile, demoProfile),
              complianceScore: compliance,
              inspectionCount,
              violationCount: isDemo
                ? 3
                : (live?.violations.filter((v) => v.status === "pending").length ?? 0),
              topViolation,
            })
          }
        />
        <ReportCard
          icon={Award}
          title="Good standing"
          description={`${cleanCount} properties compliant. Generate recognition reports for homeowners.`}
          onExport={() =>
            exportPdf({
              hoaName: displayHoaName(profile, demoProfile),
              complianceScore: compliance,
              inspectionCount,
              violationCount: 0,
              topViolation: "Good standing report",
            })
          }
        />
        <ReportCard
          icon={FileText}
          title="Violation summary"
          description={`Most common: ${topViolation}. ${repeatCount} repeat address${repeatCount === 1 ? "" : "es"}.`}
          onExport={() =>
            exportPdf({
              hoaName: displayHoaName(profile, demoProfile),
              complianceScore: compliance,
              inspectionCount,
              violationCount: repeatCount,
              topViolation,
            })
          }
        />
      </div>
    </PageContent>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  onExport,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
  onExport?: () => void;
}) {
  return (
    <Card hover>
      <Icon className="h-5 w-5 text-ink-400" strokeWidth={1.5} />
      <h3 className="mt-4 font-display font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onExport}>
        <Download className="h-4 w-4" />
        Export PDF
      </Button>
    </Card>
  );
}
