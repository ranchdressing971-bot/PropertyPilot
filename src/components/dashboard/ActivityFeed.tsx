"use client";

import { motion } from "framer-motion";
import { ActivityItem } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  Video,
  AlertTriangle,
  FileText,
  CheckCircle2,
} from "lucide-react";

const iconMap = {
  inspection: Video,
  violation: AlertTriangle,
  report: FileText,
  resolved: CheckCircle2,
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-ink-900">
        Recent activity
      </h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">Nothing here yet.</p>
      ) : (
        <motion.div
          className="mt-5 divide-y divide-ink-100"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {items.map((item) => {
            const Icon = iconMap[item.type];
            return (
              <motion.div
                key={item.id}
                variants={staggerItem}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                  <Icon className="h-3.5 w-3.5 text-ink-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink-700">{item.message}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{item.time}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </Card>
  );
}
