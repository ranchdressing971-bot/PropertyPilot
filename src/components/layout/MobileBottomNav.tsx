"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Video,
  Home,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  FileText,
  Settings,
  X,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/dashboard/inspections", label: "Inspections", icon: Video, match: "/dashboard/inspections" },
  { href: "/dashboard/inspections/upload", label: "Upload", icon: Plus, primary: true },
  { href: "/dashboard/properties", label: "Properties", icon: Home, match: "/dashboard/properties" },
];

const moreLinks = [
  { href: "/dashboard/violations", label: "Violations", icon: AlertTriangle },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreLinks.some((l) => pathname.startsWith(l.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute bottom-20 left-3 right-3 rounded-2xl border border-ink-200 bg-white p-2 shadow-card-hover"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mb-1 flex items-center justify-between px-2 py-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                More
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {moreLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                    active
                      ? "bg-brand-50 text-brand-800"
                      : "text-ink-700 hover:bg-ink-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200/80 bg-white/95 shadow-nav backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg items-end justify-between px-1 pt-1.5">
          {tabs.map((tab) => {
            const isActive = tab.primary
              ? pathname === tab.href
              : tab.match === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.match!);
            const Icon = tab.icon;

            if (tab.primary) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="relative -mt-5 flex flex-1 flex-col items-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white shadow-card-hover">
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <span className="mt-1 text-[10px] font-medium text-ink-600">
                    {tab.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  "flex min-h-[3rem] flex-1 flex-col items-center justify-end gap-0.5 px-1 pb-0.5",
                  isActive ? "text-brand-600" : "text-ink-400"
                )}
              >
                <Icon className={clsx("h-5 w-5", isActive && "stroke-[2.25]")} />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={clsx(
              "flex min-h-[3rem] flex-1 flex-col items-center justify-end gap-0.5 px-1 pb-0.5",
              moreActive || moreOpen ? "text-brand-600" : "text-ink-400"
            )}
          >
            <MoreHorizontal className={clsx("h-5 w-5", (moreActive || moreOpen) && "stroke-[2.25]")} />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
