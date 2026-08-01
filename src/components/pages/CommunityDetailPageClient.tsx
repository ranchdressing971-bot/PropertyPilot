"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RosterImport } from "@/components/properties/RosterImport";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useRoster } from "@/hooks/useRoster";
import {
  DEMO_COMMUNITIES,
  properties as demoProperties,
  type Property,
} from "@/lib/mock-data";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  Home,
  Loader2,
  Upload,
} from "lucide-react";

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

export function CommunityDetailPageClient({ id }: { id: string }) {
  const router = useRouter();
  const { isDemo, isLive } = useAppMode();
  const { importCsv, properties: roster } = useRoster();
  const [showRoster, setShowRoster] = useState(true);
  const [name, setName] = useState("");
  const [list, setList] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (isDemo) {
        const community = DEMO_COMMUNITIES.find((c) => c.id === id);
        if (!community) {
          if (!cancelled) {
            setError("Community not found");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setName(community.name);
          setList(
            demoProperties.filter(
              (p) =>
                p.communityId === community.id ||
                p.neighborhood === community.name
            )
          );
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/communities/${id}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Community not found");
        if (!cancelled) {
          setName(data.community?.name ?? "Community");
          setList(data.properties ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Community not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, isDemo]);

  if (loading) {
    return (
      <DashboardLayout>
        <Header title="Community" />
        <PageContent>
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
          </div>
        </PageContent>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Header title="Community" />
        <PageContent>
          <EmptyState
            icon={Home}
            title="Community not found"
            description={error}
            actionLabel="Back to communities"
            actionHref="/dashboard/communities"
          />
        </PageContent>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Header
        title={name}
        subtitle={`${list.length} propert${list.length === 1 ? "y" : "ies"} in this community`}
      />
      <PageContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/communities"
            className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All communities
          </Link>
          <Button
            size="sm"
            onClick={() =>
              router.push(
                `/dashboard/inspections/upload?community=${encodeURIComponent(id)}`
              )
            }
          >
            <Upload className="h-4 w-4" />
            Upload inspection
          </Button>
        </div>

        {isLive && (
          <div>
            <button
              type="button"
              onClick={() => setShowRoster(!showRoster)}
              className="flex w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-left text-sm text-ink-700 hover:bg-brand-50"
            >
              <span>
                {roster.length > 0
                  ? `Address roster · ${roster.length} homes (improves mailbox matching)`
                  : "Import address roster: recommended before your next upload"}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showRoster ? "rotate-180" : ""}`}
              />
            </button>
            {showRoster && (
              <div className="mt-3">
                <RosterImport
                  neighborhood={name}
                  onImport={async (csv) => importCsv(csv, name, id)}
                />
              </div>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No properties yet"
            description="Upload a drive-through for this community, then use Add all on the results page to save homes here."
            actionLabel="Upload inspection"
            actionHref={`/dashboard/inspections/upload?community=${encodeURIComponent(id)}`}
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {list.map((property) => (
              <motion.div key={property.id} variants={staggerItem}>
                <Link href={`/dashboard/properties/${property.id}`}>
                  <Card hover className="h-full">
                    <PropertyThumb
                      address={property.address}
                      image={property.image}
                    />
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
              </motion.div>
            ))}
          </motion.div>
        )}
      </PageContent>
    </DashboardLayout>
  );
}
