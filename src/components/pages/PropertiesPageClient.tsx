"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import {
  PropertiesPageContent,
  getPropertiesSubtitle,
} from "@/components/pages/PropertiesPageContent";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { properties as demoProperties } from "@/lib/mock-data";

export function PropertiesPageClient() {
  const { isDemo } = useAppMode();
  const { data: live } = useLiveDashboard(!isDemo);
  const count = isDemo ? demoProperties.length : (live?.properties.length ?? 0);

  return (
    <DashboardLayout>
      <Header title="Properties" subtitle={getPropertiesSubtitle(isDemo, count)} />
      <PropertiesPageContent />
    </DashboardLayout>
  );
}
