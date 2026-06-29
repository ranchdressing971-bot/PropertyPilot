"use client";

import clsx from "clsx";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function ModeBadge({ className }: { className?: string }) {
  const { mode, ready } = useAppMode();

  if (!ready) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        mode === "demo"
          ? "bg-copper-100 text-copper-800"
          : "bg-ink-900 text-white",
        className
      )}
    >
      {mode === "demo" ? "Demo" : "Live"}
    </span>
  );
}
