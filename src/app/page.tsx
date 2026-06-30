"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HomeLogo } from "@/components/brand/HomeLogo";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { Upload, Play, Shield, BarChart3, ArrowRight, LogIn, Video } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { setMode } = useAppMode();

  function startDemo() {
    setMode("demo");
    router.push("/dashboard/inspections/insp-1");
  }

  function startLive() {
    setMode("live");
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-ink-950">
      <nav className="border-b border-ink-200/80 bg-canvas dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <HomeLogo size="sm" href="/" />
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="text-sm font-medium text-ink-500 hover:text-ink-900">
              Pricing
            </Link>
            <Button variant="ghost" size="sm" onClick={startLive}>
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
            <Button size="sm" onClick={startDemo}>
              View demo
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-600 dark:text-copper-400">
              HOA inspection software
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 dark:text-ink-50 sm:text-5xl lg:text-6xl">
              Drive once.
              <br />
              Review every home.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-500 dark:text-ink-400 sm:text-lg">
              Upload a neighborhood drive-through. AI scans each property and
              prepares violation reports for your review — no clip-by-clip work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={startDemo}>
                <Play className="h-4 w-4" />
                Explore demo
              </Button>
              <Button variant="secondary" size="lg" onClick={startLive}>
                Start live
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="surface overflow-hidden p-2 dark:border-ink-800 dark:bg-ink-900">
              <div className="rounded-lg bg-ink-950 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-800">
                    <Video className="h-5 w-5 text-copper-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Willow Creek scan</p>
                    <p className="text-xs text-ink-400">20 properties · 3 flags</p>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  {["123 Main St — trash bin", "789 Pine Ln — tall grass", "456 Oak Dr — clear"].map(
                    (row) => (
                      <div
                        key={row}
                        className="rounded-md border border-ink-800 bg-ink-900/80 px-3 py-2 text-xs text-ink-300"
                      >
                        {row}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-200/80 bg-white py-16 dark:border-ink-800 dark:bg-ink-900 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 sm:grid-cols-3 sm:px-8">
          {[
            {
              icon: Upload,
              title: "Upload once",
              desc: "Phone or desktop. Drop a drive-through and go.",
            },
            {
              icon: Shield,
              title: "AI compliance",
              desc: "Vision models flag bins, grass, debris, and landscaping.",
            },
            {
              icon: BarChart3,
              title: "Manager review",
              desc: "Approve notices, track compliance, export reports.",
            },
          ].map((f) => (
            <div key={f.title}>
              <f.icon className="h-5 w-5 text-ink-400" strokeWidth={1.5} />
              <h3 className="mt-3 font-display font-semibold text-ink-900 dark:text-ink-100">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-ink-950 px-6 py-10 text-white sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="font-display text-2xl font-semibold">Ready to pilot?</h2>
            <p className="mt-2 max-w-md text-sm text-ink-400">
              Demo with sample data, or sign in for live AI scans.
            </p>
          </div>
          <Link href="/dashboard">
            <Button className="bg-white text-ink-900 hover:bg-ink-100">
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-200/80 py-6 dark:border-ink-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <HomeLogo size="sm" href="/" />
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-400">
            <Link href="/pricing" className="hover:text-ink-600">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-ink-600">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink-600">
              Terms
            </Link>
            <span>&copy; 2026 Property Pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
