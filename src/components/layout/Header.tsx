"use client";

import Link from "next/link";
import { Upload, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModeBadge } from "@/components/brand/ModeBadge";
import { useMobileNav } from "./MobileNavContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-white/80 shadow-nav backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              onClick={toggle}
              className="-ml-1 shrink-0 rounded-xl p-2 text-ink-500 transition-colors hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                  {title}
                </h1>
                <ModeBadge />
              </div>
              {subtitle && (
                <p className="mt-1 text-sm text-ink-500 line-clamp-2 sm:line-clamp-none">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <Link href="/dashboard/inspections/upload" className="hidden shrink-0 md:block">
            <Button size="sm">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
