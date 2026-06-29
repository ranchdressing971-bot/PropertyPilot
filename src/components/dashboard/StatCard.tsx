"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  index?: number;
}

export function StatCard({ title, value, icon: Icon, trend, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="min-w-0"
    >
      <Card hover className="relative h-full overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-snug text-slate-500 sm:text-sm">
              {title}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {value}
            </p>
            {trend && (
              <p className="mt-1.5 text-xs text-emerald-600">{trend}</p>
            )}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50">
            <Icon className="h-5 w-5 text-accent-600" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
