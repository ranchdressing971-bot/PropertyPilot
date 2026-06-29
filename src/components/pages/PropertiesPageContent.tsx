"use client";

import Link from "next/link";
import Image from "next/image";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { properties as demoProperties } from "@/lib/mock-data";
import { ArrowRight, Calendar, Home, Loader2 } from "lucide-react";

function PropertyThumb({ address, image }: { address: string; image: string }) {
  if (image) {
    return (
      <div className="relative h-40 w-full overflow-hidden rounded-lg sm:h-36">
        <Image src={image} alt={address} fill className="object-cover" />
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
  const { data: live, loading } = useLiveDashboard(isLive);

  const list = isDemo ? demoProperties : (live?.properties ?? []);

  if (isLive && loading && !live) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      {list.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Properties from your uploaded scans will appear here automatically."
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
  return count > 0 ? `${count} properties from your scans` : "From your inspection scans";
}
