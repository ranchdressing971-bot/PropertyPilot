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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(43,111,75,0.14),transparent_55%)]" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(28,36,32,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(28,36,32,0.9) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(180deg, black 20%, transparent 90%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-12 lg:grid-cols-[1fr_1.02fr] lg:gap-14 lg:pt-10">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Logo size="lg" className="mb-7 sm:mb-9 sm:text-[2.75rem]" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-balance text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-ink-900 sm:text-5xl"
            >
              One drive.
              <br />
              <span className="text-brand-600">Whole street</span> reviewed.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg"
            >
              Film your next drive-through. We match homes, pull evidence, and
              hand you a review list. You approve before anything is sent.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center"
            >
              <Button size="lg" onClick={claimFreeRun} className="sm:min-w-[210px]">
                {isHome ? "Start free" : "Claim free run"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" onClick={peekDemo}>
                Peek a sample
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 text-sm text-ink-500"
            >
              No card required · 1 free inspection per account
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-brand-500/10 via-transparent to-brand-700/5 blur-xl sm:-inset-4" />
            <div className="relative overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <div>
                  <p className="page-eyebrow">Live inspection</p>
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
                      className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 ring-1 ring-brand-200"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Ready to review
                    </motion.span>
                  ) : (
                    <motion.span
                      key="scan"
                      className="rounded-md bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-600 ring-1 ring-ink-200"
                    >
                      Matching homes…
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <div className="px-4 pt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <motion.div
                    className="h-full rounded-full bg-brand-600"
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
                          : { opacity: 0.28, x: 0 }
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
                              className="absolute inset-0 flex items-center justify-center bg-brand-600/92"
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
                                ? "text-xs text-signal-600"
                                : home.tone === "review"
                                  ? "text-xs text-ink-500"
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
                          className="text-[11px] font-medium text-brand-600"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="border-t border-ink-100 bg-ink-50/70 px-4 py-3">
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.p
                      key="cta-line"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-ink-700"
                    >
                      Same workflow on your streets. One free run to start.
                    </motion.p>
                  ) : (
                    <motion.p key="wait" className="text-xs text-ink-500">
                      Matching addresses · pulling evidence frames…
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
