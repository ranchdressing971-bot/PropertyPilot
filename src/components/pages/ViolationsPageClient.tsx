"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import {
  ViolationsPageContent,
  getViolationsSubtitle,
} from "@/components/pages/ViolationsPageContent";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { violations as demoViolations } from "@/lib/mock-data";

export function ViolationsPageClient() {
  const { isDemo } = useAppMode();
  const { data: live } = useLiveDashboard(!isDemo);
  const list = isDemo ? demoViolations : (live?.violations ?? []);
  const pending = list.filter((v) => v.status === "pending").length;

  return (
    <DashboardLayout>
      <Header
        title="Violations"
        subtitle={getViolationsSubtitle(isDemo, pending, list.length)}
      />
      <ViolationsPageContent />
    </DashboardLayout>
  );
}
