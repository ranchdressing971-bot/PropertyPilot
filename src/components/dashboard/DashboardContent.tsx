"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { dashboardStats, activityFeed } from "@/lib/mock-data";
import { MapPin, Video, AlertTriangle, Clock } from "lucide-react";

export function DashboardContent() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Neighborhoods Inspected"
          value={dashboardStats.neighborhoodsInspected}
          icon={MapPin}
          trend="+1 this month"
          index={0}
        />
        <StatCard
          title="Videos Processed"
          value={dashboardStats.videosProcessed}
          icon={Video}
          trend="+4 this month"
          index={1}
        />
        <StatCard
          title="Potential Violations"
          value={dashboardStats.potentialViolations}
          icon={AlertTriangle}
          index={2}
        />
        <StatCard
          title="Time Saved"
          value={`${dashboardStats.timeSavedHours}h`}
          icon={Clock}
          trend="vs manual inspections"
          index={3}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActivityFeed items={activityFeed} />
        </div>
        <div className="lg:col-span-2">
          <AIInsights />
        </div>
      </div>
    </div>
  );
}
