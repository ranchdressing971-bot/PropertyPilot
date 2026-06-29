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
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/75 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={toggle}
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search properties..."
              className="h-9 w-52 rounded-xl border border-slate-200/80 bg-slate-50/80 pl-9 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-accent-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 lg:w-64"
            />
          </div>
          <button className="relative rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
          </button>
          <Link href="/dashboard/inspections/upload" className="hidden sm:block">
            <Button size="sm">
              <Upload className="h-4 w-4" />
              <span className="hidden lg:inline">Upload Video</span>
              <span className="lg:hidden">Upload</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
