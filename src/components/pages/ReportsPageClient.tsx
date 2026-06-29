"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { ReportsPageContent } from "@/components/pages/ReportsPageContent";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function ReportsPageClient() {
  const { isDemo } = useAppMode();

  return (
    <DashboardLayout>
      <Header
        title="Reports"
        subtitle={isDemo ? "Sample compliance exports" : "Generated from your scans"}
      />
      <ReportsPageContent />
    </DashboardLayout>
  );
}
