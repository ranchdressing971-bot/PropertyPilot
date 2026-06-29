"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Video,
  Home,
  AlertTriangle,
  FileText,
  Settings,
  Plane,
  X,
} from "lucide-react";
import { useMobileNav } from "./MobileNavContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-accent-500/10 text-accent-700 shadow-sm shadow-accent-500/5"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            )}
          >
            <Icon
              className={clsx(
                "h-5 w-5",
                isActive ? "text-accent-600" : "text-slate-400"
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

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-slate-200/60 bg-white/90 backdrop-blur-xl lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={close}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-[min(85vw,280px)] flex-col bg-white shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 shadow-lg shadow-accent-500/30">
                    <Plane className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    Property Pilot
                  </span>
                </div>
                <button
                  onClick={close}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
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

function SidebarContent() {
  return (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200/60 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 shadow-lg shadow-accent-500/25">
          <Plane className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-slate-900">
          Property Pilot
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavLinks />
      </nav>

      <div className="border-t border-slate-200/60 p-4">
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-accent-50/50 p-4 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold text-slate-900">Willow Creek HOA</p>
          <p className="mt-0.5 text-xs text-slate-500">Manager Portal</p>
        </div>
      </div>
    </>
  );
}
