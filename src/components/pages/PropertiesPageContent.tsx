"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RosterImport } from "@/components/properties/RosterImport";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useRoster } from "@/hooks/useRoster";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { properties as demoProperties } from "@/lib/mock-data";
import { ArrowRight, Calendar, ChevronDown, Home, Loader2 } from "lucide-react";

function PropertyThumb({ address, image }: { address: string; image: string }) {
  if (image) {
    return (
      <div className="relative h-40 w-full overflow-hidden rounded-lg bg-ink-100 sm:h-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={address} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initials = address
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gradient-to-br from-ink-100 to-ink-50 sm:h-36">
      <span className="font-display text-2xl font-semibold text-ink-300">
        {initials}
      </span>
    </div>
  );
}

export function PropertiesPageContent() {
  const { isDemo, isLive } = useAppMode();
  const { profile } = useUserProfile();
  const { data: live, loading: liveLoading } = useLiveDashboard(isLive);
  const { importCsv, properties: roster } = useRoster();
  const [showRoster, setShowRoster] = useState(true);

  const list = isDemo ? demoProperties : (live?.properties ?? []);
  const loading = isLive && liveLoading && !live;
  const rosterCount = roster.length;

  if (loading) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="space-y-8">
      {isLive && (
        <div>
          <button
            type="button"
            onClick={() => setShowRoster(!showRoster)}
            className="flex w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-left text-sm text-ink-700 hover:bg-brand-50"
          >
            <span>
              {rosterCount > 0
                ? `Address roster · ${rosterCount} homes (improves mailbox matching)`
                : "Import address roster — recommended before your next upload"}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showRoster ? "rotate-180" : ""}`}
            />
          </button>
          {showRoster && (
            <div className="mt-3">
              <RosterImport
                neighborhood={profile?.hoaName || "Your Community"}
                onImport={async (csv) => {
                  return importCsv(csv, profile?.hoaName || "Your Community");
                }}
              />
            </div>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Import your community CSV above, then upload a drive-through — AI matches mailbox numbers to your roster."
          actionLabel="Upload inspection"
          actionHref="/dashboard/inspections/upload"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((property) => (
            <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
              <Card hover className="h-full">
                <PropertyThumb address={property.address} image={property.image} />
                <div className="mt-4 space-y-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink-900">
                      {property.address}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {property.lastInspection}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge status={property.status} />
                    <span className="flex items-center text-sm font-medium text-ink-600">
                      View
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContent>
  );
}

export function getPropertiesSubtitle(isDemo: boolean, count: number) {
  if (isDemo) return `${count} homes in Willow Creek Estates`;
  return count > 0 ? `${count} homes found from your inspections` : "Upload a video to discover homes";
}
