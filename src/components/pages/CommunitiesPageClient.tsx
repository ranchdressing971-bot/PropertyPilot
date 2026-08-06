"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import {
  CommunitiesPageContent,
  getCommunitiesSubtitle,
} from "@/components/pages/CommunitiesPageContent";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useCommunities } from "@/hooks/useCommunities";

export function CommunitiesPageClient() {
  const { isDemo } = useAppMode();
  const { communities, limit } = useCommunities(true);

  return (
    <DashboardLayout>
      <Header
        title="Communities"
        subtitle={getCommunitiesSubtitle(
          isDemo,
          communities.length,
          limit?.limit
        )}
      />
      <CommunitiesPageContent />
    </DashboardLayout>
  );
}
