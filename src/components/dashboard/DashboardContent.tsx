"use client";

import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { PageContent } from "@/components/layout/PageContent";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  activityFeed,
  aiInsights,
  dashboardStats,
} from "@/lib/mock-data";
import { MapPin, Video, AlertTriangle, Clock, Upload, Loader2 } from "lucide-react";

export function DashboardContent() {
  const { isDemo, isLive } = useAppMode();
  const { data: live, loading } = useLiveDashboard(isLive);

  const stats = isDemo ? dashboardStats : (live?.stats ?? dashboardStats);
  const activity = isDemo ? activityFeed : (live?.activity ?? []);
  const insights = isDemo ? aiInsights : live?.insights;
  const hasLiveData = isLive && (live?.inspections.length ?? 0) > 0;

  if (isLive && loading && !live) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  if (isLive && !hasLiveData) {
    return (
      <PageContent>
        <EmptyState
          icon={Video}
          title="No inspections yet"
          description="Upload a neighborhood drive-through video to run your first AI-powered inspection."
          actionLabel="Upload video"
        />
      </PageContent>
    );
  }

  return (
    <PageContent>
      {isLive && (
        <div className="flex justify-end">
          <Link href="/dashboard/inspections/upload">
            <Button size="sm">
              <Upload className="h-4 w-4" />
              New inspection
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Neighborhoods"
          value={stats.neighborhoodsInspected}
          icon={MapPin}
        />
        <StatCard
          title="Videos"
          value={stats.videosProcessed}
          icon={Video}
        />
        <StatCard
          title="Pending flags"
          value={stats.potentialViolations}
          icon={AlertTriangle}
        />
        <StatCard
          title="Hours saved"
          value={`${stats.timeSavedHours}h`}
          icon={Clock}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <ActivityFeed items={activity} />
        </div>
        <div className="lg:col-span-2">
          {insights ? (
            <AIInsights insights={insights} />
          ) : (
            <AIInsights
              insights={{
                mostCommonViolation: "—",
                avgInspectionTime: "—",
                complianceScore: 0,
                repeatOffenders: [],
              }}
              empty
            />
          )}
        </div>
      </div>
    </PageContent>
  );
}
