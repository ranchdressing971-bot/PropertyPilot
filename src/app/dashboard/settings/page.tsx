import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { CcrRulesCard } from "@/components/settings/CcrRulesCard";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { BillingCard } from "@/components/settings/BillingCard";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <Header title="Settings" subtitle="Profile, billing, and preferences" />
      <PageContent className="max-w-2xl">
        <div className="space-y-5">
          <ProfileCard />
          <Suspense fallback={null}>
            <BillingCard />
          </Suspense>
          <NotificationsCard />
          <CcrRulesCard />
        </div>

        <Suspense fallback={null}>
          <div className="mt-5">
            <SettingsPanel />
          </div>
        </Suspense>
      </PageContent>
    </DashboardLayout>
  );
}
