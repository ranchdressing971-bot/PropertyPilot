"use client";

import clsx from "clsx";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function ModeBadge({ className }: { className?: string }) {
  const { mode, ready } = useAppMode();

  if (!ready) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        mode === "demo"
          ? "bg-ink-100 text-ink-600 ring-ink-200"
          : "bg-brand-50 text-brand-700 ring-brand-200",
        className
      )}
    >
      {mode === "demo" ? "Demo" : "Live"}
    </span>
  );
}
