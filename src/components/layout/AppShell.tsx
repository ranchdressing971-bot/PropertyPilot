"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  Wind,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, mode, searchAll } = useTradeFlow();
  const [mobileMore, setMobileMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => (query.length >= 2 ? searchAll(query) : null), [query, searchAll]);

  const primaryMobile = nav.slice(0, 4);
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) setSearchOpen(true);
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200/80 bg-white/90 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-cta">
            <Wind className="h-5 w-5" />
          </span>
          <div>
            <div className="font-display text-base font-semibold text-ink-900">TradeFlow</div>
            <div className="truncate text-xs text-ink-500">{business.name}</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                )}
              >
                <Icon className="h-4.5 w-4.5 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => router.push("/dashboard/jobs/new")}
          className="btn-primary mt-4 w-full"
        >
          <Plus className="h-4 w-4" />
          New job
        </button>

        {mode === "demo" ? (
          <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Demo mode · Coastal Air & Heating
          </p>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 lg:hidden">
              <div className="font-display text-sm font-semibold text-ink-900">TradeFlow</div>
              <div className="truncate text-xs text-ink-500">{business.name}</div>
            </div>
            <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search customers, jobs, invoices…"
                className="input-field pl-9"
              />
            </form>
            <button
              type="button"
              className="btn-ghost sm:hidden"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/jobs/new")}
              className="btn-primary hidden sm:inline-flex lg:hidden"
            >
              <Plus className="h-4 w-4" />
              New job
            </button>
          </div>

          {searchOpen ? (
            <div className="relative mt-3 sm:mt-2">
              <form onSubmit={onSearch} className="relative sm:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="input-field pl-9"
                  autoFocus
                />
              </form>
              {results ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-2xl border border-ink-200 bg-white p-2 shadow-card-hover">
                  {!results.customers.length &&
                  !results.jobs.length &&
                  !results.invoices.length ? (
                    <p className="px-3 py-4 text-sm text-ink-500">No results found.</p>
                  ) : (
                    <>
                      {results.customers.slice(0, 4).map((c) => (
                        <Link
                          key={c.id}
                          href={`/dashboard/customers/${c.id}`}
                          className="block rounded-xl px-3 py-2 text-sm hover:bg-ink-50"
                          onClick={() => setSearchOpen(false)}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                            Customer
                          </span>
                          <div className="font-medium text-ink-900">{c.full_name}</div>
                        </Link>
                      ))}
                      {results.jobs.slice(0, 4).map((j) => (
                        <Link
                          key={j.id}
                          href={`/dashboard/jobs/${j.id}`}
                          className="block rounded-xl px-3 py-2 text-sm hover:bg-ink-50"
                          onClick={() => setSearchOpen(false)}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                            Job
                          </span>
                          <div className="font-medium text-ink-900">{j.title}</div>
                        </Link>
                      ))}
                      {results.invoices.slice(0, 4).map((i) => (
                        <Link
                          key={i.id}
                          href={`/dashboard/invoices/${i.id}`}
                          className="block rounded-xl px-3 py-2 text-sm hover:bg-ink-50"
                          onClick={() => setSearchOpen(false)}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                            Invoice
                          </span>
                          <div className="font-medium text-ink-900">{i.invoice_number}</div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <main className="safe-pb mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200/80 bg-white/95 shadow-nav backdrop-blur lg:hidden">
        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1">
          {primaryMobile.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium",
                  active ? "text-brand-700" : "text-ink-500"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMore(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium text-ink-500"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <button
        type="button"
        onClick={() => router.push("/dashboard/jobs/new")}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-cta lg:hidden"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        aria-label="New job"
      >
        <Plus className="h-6 w-6" />
      </button>

      {mobileMore ? (
        <div className="fixed inset-0 z-[60] bg-ink-950/40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close menu"
            onClick={() => setMobileMore(false)}
          />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">More</h2>
              <button type="button" className="btn-ghost" onClick={() => setMobileMore(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-1">
              {nav.slice(4).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMore(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-800 hover:bg-ink-50"
                  >
                    <Icon className="h-5 w-5 text-brand-600" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
