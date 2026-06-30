"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/Button";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  Upload,
  Play,
  Shield,
  BarChart3,
  ArrowRight,
  Video,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { setMode } = useAppMode();

  function startDemo() {
    setMode("demo");
    router.push("/dashboard/inspections/insp-1");
  }

  function startLive() {
    setMode("live");
    router.push("/signup");
  }

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.08),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center rounded-full border border-brand-200/80 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                AI-powered HOA inspections
              </p>
              <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.25rem]">
                Drive once.
                <br />
                Review every home.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-500 sm:text-lg">
                Upload a neighborhood drive-through. AI scans each property and
                prepares violation reports for your review — no clip-by-clip work.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={startDemo}>
                  <Play className="h-4 w-4" />
                  Explore demo
                </Button>
                <Button variant="secondary" size="lg" onClick={startLive}>
                  Start free — 3 scans
                </Button>
              </div>
              <ul className="mt-8 flex flex-col gap-2 text-sm text-ink-600 sm:flex-row sm:gap-6">
                {["No credit card", "Works on phone video", "Manager review workflow"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="relative lg:pl-4">
              <div className="surface overflow-hidden p-2">
                <div className="rounded-xl bg-ink-950 p-6 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
                      <Video className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Willow Creek scan</p>
                      <p className="text-xs text-ink-400">12 properties · 2 flags</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-2">
                    {[
                      { label: "123 Main St", flag: "Trash bin visible", ok: false },
                      { label: "789 Pine Ln", flag: "Tall grass", ok: false },
                      { label: "456 Oak Dr", flag: "No violations", ok: true },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2.5"
                      >
                        <span className="text-xs font-medium text-ink-200">{row.label}</span>
                        <span
                          className={`text-[11px] ${row.ok ? "text-emerald-400" : "text-amber-400"}`}
                        >
                          {row.flag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-200/60 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:grid-cols-3 sm:px-8">
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
            <div key={f.title} className="rounded-2xl border border-ink-100 bg-canvas p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-ink-200/60">
                <f.icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="surface flex flex-col items-start justify-between gap-6 bg-ink-950 px-6 py-10 text-white sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Ready to pilot?</h2>
            <p className="mt-2 max-w-md text-sm text-ink-400">
              Demo with sample data, or start with 3 free live scans.
            </p>
          </div>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-white text-ink-900 hover:bg-ink-100"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
