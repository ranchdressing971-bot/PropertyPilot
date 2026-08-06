"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  Building2,
  AlertTriangle,
  FileText,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useMobileNav } from "./MobileNavContext";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCompanyRole } from "@/hooks/useCompanyRole";
import type { CompanyRole } from "@/lib/company";
import { displayHoaName } from "@/lib/profile";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: readonly CompanyRole[];
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["owner", "admin", "inspector"] },
  { href: "/dashboard/inspections", label: "Inspections", icon: Video, roles: ["owner", "admin", "inspector"] },
  { href: "/dashboard/communities", label: "Communities", icon: Building2, roles: ["owner", "admin", "inspector"] },
  { href: "/dashboard/violations", label: "Violations", icon: AlertTriangle, roles: ["owner", "admin", "inspector"] },
  { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ["owner", "admin"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["owner", "admin", "inspector"] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role, loading } = useCompanyRole();
  const effectiveRole: CompanyRole = role ?? "owner";

  return (
    <>
      {navItems
        .filter((item) => loading || item.roles.includes(effectiveRole))
        .map((item) => {
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
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-600/20 text-white"
                : "text-ink-400 hover:bg-white/[0.04] hover:text-ink-100"
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4 shrink-0",
                isActive ? "text-brand-300" : "text-ink-500"
              )}
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
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col border-r border-ink-800/60 bg-ink-950 lg:flex">
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
              className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(92vw,21rem)] flex-col overflow-hidden bg-ink-950 shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-ink-800/70 px-5 py-4">
                <Logo size="lg" href="/dashboard" variant="light" inverted />
                <button
                  onClick={close}
                  className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
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
  const { companyName, hoaName, role, isInspector } = useCompanyRole();

  return (
    <>
      <div className="flex h-14 items-center border-b border-ink-800/70 px-5">
        <Logo size="lg" href="/dashboard" variant="light" inverted />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <NavLinks />
      </nav>

      <div className="border-t border-ink-800/70 p-3">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            {isDemo
              ? "Demo workspace"
              : isInspector
                ? "Inspector"
                : "Workspace"}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink-100">
            {companyName || hoaName || displayHoaName(profile, isDemo)}
          </p>
          {role && !isDemo ? (
            <p className="mt-0.5 text-[11px] capitalize text-ink-500">{role}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
