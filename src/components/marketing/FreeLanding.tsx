"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";

const HOMES = [
  {
    addr: "214 Maple Lane",
    result: "Clean",
    tone: "ok" as const,
    img: "/demo/demo-clean-home.jpg",
  },
  {
    addr: "218 Maple Lane",
    result: "Trash bin visible",
    tone: "flag" as const,
    img: "/demo/demo-trash-bin.jpg",
  },
  {
    addr: "222 Maple Lane",
    result: "Clean",
    tone: "ok" as const,
    img: "/demo/demo-clean-home.jpg",
  },
  {
    addr: "230 Maple Lane",
    result: "Confirm address",
    tone: "review" as const,
    img: "/demo/demo-dead-landscaping.jpg",
  },
  {
    addr: "236 Maple Lane",
    result: "Tall grass",
    tone: "flag" as const,
    img: "/demo/demo-tall-grass.jpg",
  },
];

export type FreeLandingVariant = "home" | "free";

interface FreeLandingProps {
  /** `free` = invite/demo marketing; `home` = same look with signup-oriented CTA. */
  variant?: FreeLandingVariant;
}

export function FreeLanding({ variant = "free" }: FreeLandingProps) {
  const router = useRouter();
  const { setMode } = useAppMode();
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const isHome = variant === "home";

  useEffect(() => {
    // Mark visitor for signup copy (free invite / home start-free)
    try {
      localStorage.setItem("pp-offer", "free-run");
    } catch {
      /* ignore */
    }

    let i = 0;
    const tick = () => {
      i += 1;
      setRevealed(i);
      if (i >= HOMES.length) {
        setDone(true);
        return;
      }
      window.setTimeout(tick, 520);
    };
    const start = window.setTimeout(tick, 700);
    return () => window.clearTimeout(start);
  }, []);

  function claimFreeRun() {
    setMode("live");
    router.push("/signup?offer=free-run");
  }

  function peekDemo() {
    setMode("demo");
    router.push("/demo");
  }

  const progress = Math.round((revealed / HOMES.length) * 100);

  return (
    <PublicLayout showNavActions={isHome}>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,127,95,0.16),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-copper-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <Logo size="lg" className="mb-8" />

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl"
            >
              One drive.
              <br />
              <span className="text-brand-700">Whole street</span> reviewed.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg"
            >
              Film your next drive-through. We match house numbers, pull evidence
              frames, and hand you a clean review list — you approve before
              anything is sent.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button size="lg" onClick={claimFreeRun} className="sm:min-w-[220px]">
                {isHome ? "Start free — sign up" : "Claim your free run"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" onClick={peekDemo}>
                Peek a sample first
              </Button>
            </motion.div>

            <ul className="mt-8 space-y-2.5 text-sm text-ink-600">
              {[
                "No card · no sales call required",
                "Your community · your video · 1 full inspection per account",
                "If it saves you time, we talk monthly after",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Satisfying inspection reveal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5 }}
            className="relative"
          >
            <div className="surface overflow-hidden p-3 sm:p-4">
              <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
                      Live inspection
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-900">
                      Maple Lane · just now
                    </p>
                  </div>
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 ring-1 ring-brand-200"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Ready to review
                      </motion.span>
                    ) : (
                      <motion.span
                        key="scan"
                        className="rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-600 ring-1 ring-ink-200"
                      >
                        Matching homes…
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="px-4 pt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.35 }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-400">
                    {done
                      ? `${HOMES.length} homes scanned · evidence attached`
                      : `${revealed} of ${HOMES.length} homes`}
                  </p>
                </div>

                <div className="mt-1 divide-y divide-ink-100">
                  {HOMES.map((home, idx) => {
                    const visible = idx < revealed;
                    return (
                      <motion.div
                        key={home.addr}
                        initial={false}
                        animate={
                          visible
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0.25, x: 0 }
                        }
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={home.img}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <AnimatePresence>
                            {visible && home.tone === "ok" && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-brand-600/90"
                              >
                                <Check className="h-5 w-5 text-white" strokeWidth={3} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {home.addr}
                          </p>
                          <p
                            className={
                              !visible
                                ? "text-xs text-ink-300"
                                : home.tone === "flag"
                                  ? "text-xs text-amber-700"
                                  : home.tone === "review"
                                    ? "text-xs text-copper-700"
                                    : "text-xs text-brand-700"
                            }
                          >
                            {visible ? home.result : "Reading mailbox…"}
                          </p>
                        </div>
                        {visible && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[11px] font-medium text-ink-400"
                          >
                            ✓
                          </motion.span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="border-t border-ink-100 bg-ink-50/80 px-4 py-3">
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.p
                        key="cta-line"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs font-medium text-ink-700"
                      >
                        That feeling — but on{" "}
                        <span className="text-brand-800">your</span> streets.
                        One free run per account.
                      </motion.p>
                    ) : (
                      <motion.p
                        key="wait"
                        className="text-xs text-ink-500"
                      >
                        Matching addresses · pulling evidence frames…
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
