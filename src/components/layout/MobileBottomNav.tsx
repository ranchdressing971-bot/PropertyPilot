"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Video,
  Home,
  AlertTriangle,
  Upload,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/inspections", label: "Inspect", icon: Video },
  { href: "/dashboard/inspections/upload", label: "Upload", icon: Upload, primary: true },
  { href: "/dashboard/properties", label: "Properties", icon: Home },
  { href: "/dashboard/violations", label: "Alerts", icon: AlertTriangle },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-around py-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" &&
              !tab.primary &&
              pathname.startsWith(tab.href));
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative -mt-5 flex flex-col items-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-xl shadow-accent-600/40 ring-4 ring-white">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[10px] font-semibold text-accent-600">
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
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors",
                isActive ? "text-accent-600" : "text-slate-400"
              )}
            >
              <Icon className={clsx("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
