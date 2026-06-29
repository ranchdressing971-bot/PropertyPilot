import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, Shield, User, Building2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <Header title="Settings" subtitle="Manage your HOA portal preferences" />
      <PageContent className="max-w-2xl">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">Organization</h3>
                <p className="text-sm text-slate-500">Willow Creek Estates HOA</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Neighborhood</span>
                <span className="font-medium">Willow Creek Estates</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Properties</span>
                <span className="font-medium">20</span>
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
                <p className="text-sm text-slate-500">
                  Email alerts for new violations
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-600">Violation alerts</span>
              <div className="h-6 w-11 rounded-full bg-accent-600 p-0.5">
                <div className="h-5 w-5 translate-x-5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="font-semibold text-slate-900">CC&R Rules</h3>
                <p className="text-sm text-slate-500">
                  Configure violation detection rules
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {[
                "Trash Bin Visible",
                "Tall Grass",
                "Debris",
                "Dead Landscaping",
              ].map((rule) => (
                <div
                  key={rule}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-slate-700">{rule}</span>
                  <span className="text-xs font-medium text-emerald-600">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
