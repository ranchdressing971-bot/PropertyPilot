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
    <Card className="h-full" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {title}
          </p>
          <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
          <Icon className="h-4 w-4 text-brand-600" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
