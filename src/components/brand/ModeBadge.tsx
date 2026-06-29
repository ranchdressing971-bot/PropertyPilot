"use client";

import clsx from "clsx";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function ModeBadge({ className }: { className?: string }) {
  const { mode, ready } = useAppMode();

  if (!ready) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        mode === "demo"
          ? "bg-violet-100 text-violet-700"
          : "bg-emerald-100 text-emerald-700",
        className
      )}
    >
      {mode === "demo" ? "Demo Mode" : "Live Mode"}
    </span>
  );
}
