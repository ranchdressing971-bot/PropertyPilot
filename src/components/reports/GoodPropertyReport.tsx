"use client";

import { Property } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Award, Download } from "lucide-react";
import { downloadComplianceReportPdf } from "@/lib/pdf-notice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { displayHoaName } from "@/lib/profile";

interface GoodPropertyReportProps {
  property: Property;
}

export function GoodPropertyReport({ property }: GoodPropertyReportProps) {
  const { profile, isDemo } = useUserProfile();

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-emerald-600" />
        <h3 className="text-sm font-semibold text-emerald-900">
          Excellent Property Report
        </h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-emerald-800">
        Thank you for maintaining your property. No violations were detected
        during the inspection on {property.lastInspection}.
      </p>
      <p className="mt-2 text-xs text-emerald-600">
        {property.address} · {property.neighborhood}
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-4 w-full"
        onClick={() =>
          downloadComplianceReportPdf({
            hoaName: displayHoaName(profile, isDemo),
            complianceScore: 100,
            inspectionCount: 1,
            violationCount: 0,
            topViolation: `Good standing — ${property.address}`,
          })
        }
      >
        <Download className="h-4 w-4" />
        Download Report
      </Button>
    </Card>
  );
}
