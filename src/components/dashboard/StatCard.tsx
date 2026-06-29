"use client";

import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  index?: number;
}

export function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {title}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50">
          <Icon className="h-4 w-4 text-ink-500" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
