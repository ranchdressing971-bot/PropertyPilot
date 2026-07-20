"use client";

import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { Play, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

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
      <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(79,127,95,0.14),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <Logo size="lg" className="mb-8" />
            <h1 className="font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
              Drive once.
              <br />
              Review every home.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg">
              RideBy turns a neighborhood drive-through into a manager-ready
              inspection — addresses matched, flags prepared, you approve.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={startLive}>
                Start free — from $99/mo
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" onClick={startDemo}>
                <Play className="h-4 w-4" />
                Explore demo
              </Button>
            </div>
            <p className="mt-5 text-sm text-ink-500">
              Built for HOA managers. Share demo:{" "}
              <a href="/demo" className="font-medium text-brand-700 underline">
                /demo
              </a>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.1 }}
            className="relative"
          >
            <div className="surface overflow-hidden p-3 sm:p-4">
              <div className="rounded-xl border border-ink-100 bg-white">
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                      Inspection results
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-900">
                      Willow Creek · Today
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                    2 need review
                  </span>
                </div>
                <div className="divide-y divide-ink-100">
                  {[
                    {
                      addr: "123 Maple Lane",
                      status: "Trash bin visible",
                      tone: "flag" as const,
                      conf: "88%",
                      img: "/demo/demo-trash-bin.jpg",
                    },
                    {
                      addr: "456 Oak Drive",
                      status: "Clean",
                      tone: "ok" as const,
                      conf: "—",
                      img: "/demo/demo-clean-home.jpg",
                    },
                    {
                      addr: "789 Pine Court",
                      status: "Confirm address",
                      tone: "review" as const,
                      conf: "62%",
                      img: "/demo/demo-tall-grass.jpg",
                    },
                  ].map((row, i) => (
                    <motion.div
                      key={row.addr}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.22 + i * 0.07,
                        type: "spring",
                        stiffness: 400,
                        damping: 28,
                      }}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.img}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {row.addr}
                        </p>
                        <p
                          className={
                            row.tone === "flag"
                              ? "text-xs text-amber-700"
                              : row.tone === "review"
                                ? "text-xs text-copper-700"
                                : "text-xs text-brand-700"
                          }
                        >
                          {row.status}
                        </p>
                      </div>
                      <span className="text-[11px] text-ink-400">{row.conf}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="border-t border-ink-100 bg-ink-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-ink-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
                    Human review required before any notice is sent
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
