"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  Home,
  AlertTriangle,
  FileText,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useMobileNav } from "./MobileNavContext";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { displayHoaName } from "@/lib/profile";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inspections", label: "Inspections", icon: Video },
  { href: "/dashboard/properties", label: "Properties", icon: Home },
  { href: "/dashboard/violations", label: "Violations", icon: AlertTriangle },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-white/10 text-white"
                : "text-ink-400 hover:bg-white/5 hover:text-ink-200"
            )}
          >
            <Icon
              className={clsx("h-4 w-4 shrink-0", isActive ? "text-brand-400" : "")}
            />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();
  const { isDemo } = useAppMode();

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[252px] flex-col border-r border-ink-800/50 bg-ink-950 lg:flex">
        <SidebarContent isDemo={isDemo} />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm lg:hidden"
              onClick={close}
            />
            <motion.aside
              key="mobile-nav-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(92vw,22.5rem)] flex-col overflow-hidden bg-ink-950 shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-ink-800/80 px-5 py-4">
                <Logo size="md" href="/dashboard" variant="light" />
                <button
                  onClick={close}
                  className="rounded-xl p-2 text-ink-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                <NavLinks onNavigate={close} />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({ isDemo }: { isDemo: boolean }) {
  const { profile } = useUserProfile();

  return (
    <>
      <div className="flex h-16 items-center border-b border-ink-800/80 px-5">
        <Logo size="md" href="/dashboard" variant="light" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        <NavLinks />
      </nav>

      <div className="border-t border-ink-800/80 p-4">
        <div className="rounded-xl border border-ink-800/80 bg-ink-900/50 px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {isDemo ? "Demo workspace" : "Your HOA"}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink-200">
            {displayHoaName(profile, isDemo)}
          </p>
        </div>
      </div>
    </>
  );
}
