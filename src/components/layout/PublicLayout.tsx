"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "./PageTransition";

interface PublicLayoutProps {
  children: React.ReactNode;
  showNavActions?: boolean;
}

export function PublicLayout({ children, showNavActions = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <nav className="sticky top-0 z-40 border-b border-ink-200/50 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <Logo size="md" href="/" />
          {showNavActions && (
            <div className="flex items-center gap-0.5 sm:gap-1.5">
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          )}
        </div>
      </nav>
      <PageTransition>{children}</PageTransition>
      <footer className="border-t border-ink-200/50 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <Logo size="sm" href="/" />
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-ink-500">
            <Link href="/pricing" className="transition-colors hover:text-ink-900">
              Pricing
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink-900">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-ink-900">
              Terms
            </Link>
            <span className="inline-flex items-center gap-1.5 text-ink-400">
              &copy; 2026 <RideByWordmark variant="inherit" className="text-sm" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
