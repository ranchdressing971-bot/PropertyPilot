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
          <p className="text-xs font-medium text-ink-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100">
          <Icon className="h-4 w-4 text-brand-600" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
