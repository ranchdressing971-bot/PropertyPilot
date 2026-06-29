"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function DashboardPageClient() {
  const { isDemo } = useAppMode();

  return (
    <DashboardLayout>
      <Header
        title="Overview"
        subtitle={
          isDemo
            ? "Willow Creek Estates — sample data"
            : "Your inspection workspace"
        }
      />
      <DashboardContent />
    </DashboardLayout>
  );
}
