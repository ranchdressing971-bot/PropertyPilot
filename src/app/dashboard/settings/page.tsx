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
      <Header title="Settings" subtitle="Mode, connections, and preferences" />
      <PageContent className="max-w-2xl">
        <SettingsPanel />

        <div className="space-y-5">
          <ProfileCard />
          <BillingCard />
          <NotificationsCard />
          <CcrRulesCard />
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
