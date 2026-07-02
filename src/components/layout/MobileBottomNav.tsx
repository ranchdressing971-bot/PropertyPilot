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
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/dashboard/inspections", label: "Inspections", icon: Video, match: "/dashboard/inspections" },
  { href: "/dashboard/inspections/upload", label: "Upload", icon: Plus, primary: true },
  { href: "/dashboard/properties", label: "Homes", icon: Home, match: "/dashboard/properties" },
  { href: "/dashboard/violations", label: "Alerts", icon: AlertTriangle, match: "/dashboard/violations" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200/80 bg-white/95 shadow-nav backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-between px-2 pt-1.5">
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
      </div>
    </nav>
  );
}
