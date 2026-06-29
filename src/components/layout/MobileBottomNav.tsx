"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Video,
  Home,
  AlertTriangle,
  Plus,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/dashboard/inspections", label: "Scans", icon: Video, match: "/dashboard/inspections" },
  { href: "/dashboard/inspections/upload", label: "Upload", icon: Plus, primary: true },
  { href: "/dashboard/properties", label: "Homes", icon: Home, match: "/dashboard/properties" },
  { href: "/dashboard/violations", label: "Alerts", icon: AlertTriangle, match: "/dashboard/violations" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/70 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-between px-3 pt-2">
        {tabs.map((tab) => {
          const isActive =
            tab.primary
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
                className="relative -mt-6 flex flex-1 flex-col items-center"
              >
                <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-lg shadow-accent-600/35 ring-[3px] ring-white">
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <span className="mt-1.5 text-[11px] font-semibold text-accent-600">
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
                "flex min-h-[3.25rem] flex-1 flex-col items-center justify-end gap-1 rounded-xl px-1 pb-0.5 transition-colors active:bg-slate-50",
                isActive ? "text-accent-600" : "text-slate-400"
              )}
            >
              <Icon className={clsx("h-[1.375rem] w-[1.375rem]", isActive && "stroke-[2.5]")} />
              <span className="text-[11px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
