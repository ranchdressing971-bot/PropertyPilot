import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Bell, Shield, User, Building2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <Header title="Settings" subtitle="Mode, connections, and preferences" />
      <PageContent className="max-w-2xl">
        <SettingsPanel />

        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">Organization</h3>
                <p className="text-sm text-slate-500">Willow Creek Estates HOA</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">Manager Profile</h3>
                <p className="text-sm text-slate-500">Sarah Mitchell</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-4">
              Edit Profile
            </Button>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                <p className="text-sm text-slate-500">Email alerts for new violations</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">CC&R Rules</h3>
                <p className="text-sm text-slate-500">Active violation detection rules</p>
              </div>
            </div>
          </Card>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
