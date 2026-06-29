"use client";

import { motion } from "framer-motion";
import { ActivityItem } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import {
  Video,
  AlertTriangle,
  FileText,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";

const iconMap = {
  inspection: Video,
  violation: AlertTriangle,
  report: FileText,
  resolved: CheckCircle2,
};

const colorMap = {
  inspection: "text-accent-600 bg-accent-50",
  violation: "text-amber-600 bg-amber-50",
  report: "text-emerald-600 bg-emerald-50",
  resolved: "text-blue-600 bg-blue-50",
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
      <div className="mt-5 space-y-5">
        {items.map((item, i) => {
          const Icon = iconMap[item.type];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-4"
            >
              <div
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  colorMap[item.type]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm leading-relaxed text-slate-700">{item.message}</p>
                <p className="mt-1 text-xs text-slate-400">{item.time}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
