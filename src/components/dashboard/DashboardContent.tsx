"use client";

import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { PageContent } from "@/components/layout/PageContent";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  activityFeed,
  aiInsights,
  dashboardStats,
} from "@/lib/mock-data";
import {
  MapPin,
  Video,
  AlertTriangle,
  Clock,
  Upload,
  FileText,
  CheckCircle2,
} from "lucide-react";

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </PageContent>
    );
  }

  if (isLive && !hasLiveData) {
    return (
      <PageContent>
        <div className="surface mx-auto max-w-xl p-8 text-center sm:p-10">
          <p className="font-display text-2xl font-semibold text-ink-900">
            Your first inspection
          </p>
          <p className="mt-2 text-sm text-ink-500">
            Three steps — then you&apos;re reviewing flags like a pro.
          </p>
          <ol className="mt-8 space-y-4 text-left">
            {[
              {
                icon: Upload,
                title: "Upload a drive-through",
                desc: "Phone video of the neighborhood is enough.",
              },
              {
                icon: AlertTriangle,
                title: "Review AI flags",
                desc: "Confirm addresses, approve or dismiss violations.",
              },
              {
                icon: FileText,
                title: "Send notices",
                desc: "Export or email only after human review.",
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-xl border border-ink-100 bg-ink-50/80 p-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                  <step.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/dashboard/inspections/upload" className="mt-8 inline-block">
            <Button size="lg">
              <Upload className="h-4 w-4" />
              Upload video
            </Button>
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
            3 free live inspections to start
          </p>
        </div>
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
            />
          )}
        </div>
      </div>
    </PageContent>
  );
}
