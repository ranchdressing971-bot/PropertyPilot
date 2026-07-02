"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { InspectionsPageContent } from "@/components/pages/InspectionsPageContent";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function InspectionsPageClient() {
  const { isDemo } = useAppMode();

  return (
    <DashboardLayout>
      <Header
        title="Inspections"
        subtitle={isDemo ? "Sample drive-through inspections" : "Your uploaded inspections"}
      />
      <InspectionsPageContent />
    </DashboardLayout>
  );
}
