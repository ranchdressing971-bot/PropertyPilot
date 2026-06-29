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
    >
      <Card hover className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
            {trend && (
              <p className="mt-1 text-xs text-emerald-600">{trend}</p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50">
            <Icon className="h-5 w-5 text-accent-600" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
