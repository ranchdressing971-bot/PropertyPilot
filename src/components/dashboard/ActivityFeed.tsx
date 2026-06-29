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
      <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
      <div className="mt-4 space-y-4">
        {items.map((item, i) => {
          const Icon = iconMap[item.type];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3"
            >
              <div
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  colorMap[item.type]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">{item.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">{item.time}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
