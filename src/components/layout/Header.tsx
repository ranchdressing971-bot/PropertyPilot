"use client";

import Link from "next/link";
import { Bell, Search, Upload, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMobileNav } from "./MobileNavContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              onClick={toggle}
              className="-ml-1 shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 line-clamp-2 sm:line-clamp-none">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <button
              className="relative hidden rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 sm:block"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
            </button>
            <Link href="/dashboard/inspections/upload" className="hidden md:block">
              <Button size="sm">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative mt-4 md:hidden">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search properties..."
            className="h-11 w-full rounded-xl border border-slate-200/80 bg-slate-50/90 pl-10 pr-4 text-base placeholder:text-slate-400 focus:border-accent-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          />
        </div>
      </div>
    </header>
  );
}
