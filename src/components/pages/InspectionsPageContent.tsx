"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { inspections as demoInspections } from "@/lib/mock-data";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Video, Upload, ArrowRight, Calendar, Loader2 } from "lucide-react";

export function InspectionsPageContent() {
  const { isDemo, isLive } = useAppMode();
  const { data: live, loading } = useLiveDashboard(isLive);

  const list = isDemo ? demoInspections : (live?.inspections ?? []);

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
      <div className="flex justify-stretch sm:justify-end">
        <Link href="/dashboard/inspections/upload" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Upload className="h-4 w-4" />
            New inspection
          </Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No inspections on file"
          description="Upload a drive-through video and AI will analyze every property along the route."
        />
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {list.map((inspection) => (
            <motion.div key={inspection.id} variants={staggerItem}>
              <Card hover>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                      <Video className="h-5 w-5 text-ink-500" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-display text-base font-semibold text-ink-900">
                        {inspection.name}
                      </h3>
                      <div className="flex flex-col gap-0.5 text-sm text-ink-500 sm:flex-row sm:gap-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {inspection.date}
                        </span>
                        <span>{inspection.neighborhood}</span>
                        <span>{inspection.propertiesScanned} properties</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-4 sm:border-0 sm:pt-0">
                    <div className="text-sm text-ink-500">
                      {inspection.violationsFound} flags
                    </div>
                    <Link href={`/dashboard/inspections/${inspection.id}`}>
                      <Button variant="secondary" size="sm">
                        Results
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageContent>
  );
}
