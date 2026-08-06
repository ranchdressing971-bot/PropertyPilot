import Link from "next/link";
import { ArrowRight, Wind } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(31,84,232,0.18),transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_10%,rgba(51,113,245,0.1),transparent_50%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-cta">
            <Wind className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold text-ink-900">TradeFlow</span>
        </div>
        <Link href="/login" className="btn-ghost text-sm">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-5xl flex-col justify-center px-5 pb-16 pt-8">
        <p className="font-display text-5xl font-semibold tracking-tight text-ink-900 sm:text-6xl md:text-7xl">
          TradeFlow
        </p>
        <h1 className="mt-5 max-w-xl text-balance text-xl font-medium leading-snug text-ink-700 sm:text-2xl">
          Know what got done, who owes you, and what each job made.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500 sm:text-base">
          The simple operating system for small HVAC companies — customers, jobs,
          invoices, and job profit in one place.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/dashboard" className="btn-primary px-6 py-3.5 text-base">
            Try the demo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/signup" className="btn-secondary px-6 py-3.5 text-base">
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
