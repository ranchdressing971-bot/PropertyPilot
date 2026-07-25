"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, animate, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Home,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import type { Property, Violation } from "@/lib/mock-data";
import clsx from "clsx";

interface DemoRow {
  property: Property;
  violation: Violation | null;
}

const DEMO_ROWS: DemoRow[] = [
  {
    property: {
      id: "demo-prop-1",
      address: "123 Main St",
      image: "/demo/demo-trash-bin.jpg",
      status: "Needs Review",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: {
      id: "demo-viol-1",
      propertyId: "demo-prop-1",
      type: "Trash Bin Visible",
      confidence: 97,
      recommendation: "Issue Warning",
      rule: "CC&R Section 4.2",
      reasoning:
        "Trash bin visible from the street outside the collection window.",
      evidenceImages: ["/demo/demo-trash-bin.jpg"],
      status: "pending",
      inspectionId: "demo-reel",
      detectedAt: "2026-06-25T14:32:00",
    },
  },
  {
    property: {
      id: "demo-prop-2",
      address: "789 Pine Lane",
      image: "/demo/demo-tall-grass.jpg",
      status: "Needs Review",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: {
      id: "demo-viol-2",
      propertyId: "demo-prop-2",
      type: "Tall Grass",
      confidence: 84,
      recommendation: "Manager Review",
      rule: "CC&R Section 6.1",
      reasoning: "",
      evidenceImages: ["/demo/demo-tall-grass.jpg"],
      status: "pending",
      inspectionId: "demo-reel",
      detectedAt: "2026-06-25T14:32:00",
    },
  },
  {
    property: {
      id: "demo-prop-3",
      address: "234 Cedar Way",
      image: "/demo/demo-debris.jpg",
      status: "Needs Review",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: {
      id: "demo-viol-3",
      propertyId: "demo-prop-3",
      type: "Debris",
      confidence: 91,
      recommendation: "Issue Warning",
      rule: "CC&R Section 5.3",
      reasoning: "",
      evidenceImages: ["/demo/demo-debris.jpg"],
      status: "pending",
      inspectionId: "demo-reel",
      detectedAt: "2026-06-25T14:32:00",
    },
  },
  {
    property: {
      id: "demo-prop-4",
      address: "654 Aspen Circle",
      image: "/demo/demo-dead-landscaping.jpg",
      status: "Needs Review",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: {
      id: "demo-viol-4",
      propertyId: "demo-prop-4",
      type: "Dead Landscaping",
      confidence: 88,
      recommendation: "Manager Review",
      rule: "CC&R Section 6.4",
      reasoning: "",
      evidenceImages: ["/demo/demo-dead-landscaping.jpg"],
      status: "pending",
      inspectionId: "demo-reel",
      detectedAt: "2026-06-25T14:32:00",
    },
  },
  {
    property: {
      id: "demo-prop-5",
      address: "456 Oak Drive",
      image: "/demo/demo-clean-home.jpg",
      status: "Good Standing",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: null,
  },
  {
    property: {
      id: "demo-prop-6",
      address: "101 Maple Court",
      image: "/demo/demo-clean-home.jpg",
      status: "Good Standing",
      lastInspection: "2026-06-25",
      neighborhood: "Willow Creek Estates",
    },
    violation: null,
  },
];

const FOCUS_ROW = DEMO_ROWS[0]!;
const VIOLATION_COUNT = DEMO_ROWS.filter((r) => r.violation).length;
const CLEAN_COUNT = DEMO_ROWS.filter((r) => !r.violation).length;

/**
 * One continuous ~11s take: stats count up, cards cascade in and float,
 * one card morphs into focus, gets approved, morphs back, outro.
 */
const CYCLE_MS = 11200;

const morphSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const gridContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.55,
    },
  },
};

const gridItem = {
  initial: { opacity: 0, y: 48, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 25,
      mass: 0.75,
    },
  },
};

function StatChip({
  icon,
  label,
  value,
  delay,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delay: number;
  tone: "brand" | "amber" | "ink";
}) {
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(0, value, {
      delay: delay + 0.25,
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        if (countRef.current) countRef.current.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 24 }}
      className="flex items-center gap-2.5 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-ink-200/80"
    >
      <span
        className={clsx(
          "flex h-6 w-6 items-center justify-center rounded-full",
          tone === "brand" && "bg-brand-50 text-brand-600",
          tone === "amber" && "bg-amber-50 text-amber-600",
          tone === "ink" && "bg-ink-100 text-ink-600"
        )}
      >
        {icon}
      </span>
      <span className="text-lg font-semibold tabular-nums text-ink-900" ref={countRef}>
        0
      </span>
      <span className="text-sm text-ink-500">{label}</span>
    </motion.div>
  );
}

function CardShell({ row, resolved }: { row: DemoRow; resolved: boolean }) {
  const { property, violation } = row;

  return (
    <Card padding="sm" className="overflow-hidden">
      <div className="relative h-32 w-full overflow-hidden rounded-xl">
        <MediaImage
          src={property.image}
          alt={property.address}
          fill
          className="object-cover"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-ink-900">
          {property.address}
        </h3>
        <Badge status={resolved ? "Resolved" : property.status} />
      </div>

      {violation && !resolved ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="truncate text-xs font-medium text-amber-900">
            {violation.type}
            <span className="ml-1.5 font-normal text-amber-800/70">
              {violation.confidence}%
            </span>
          </p>
        </div>
      ) : violation && resolved ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p className="truncate text-xs font-medium text-emerald-800">
            Warning issued
          </p>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          <p className="truncate text-xs font-medium text-brand-800">
            No violations
          </p>
        </div>
      )}
    </Card>
  );
}

function FocusCard({ approved }: { approved: boolean }) {
  const { property, violation } = FOCUS_ROW;
  if (!violation) return null;

  return (
    <Card padding="md" className="overflow-hidden shadow-card-hover">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
        <MediaImage
          src={property.image}
          alt={property.address}
          fill
          className="object-cover"
        />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">
            {violation.type}
          </h3>
          <p className="mt-0.5 text-sm text-ink-500">{property.address}</p>
        </div>
        <Badge status={approved ? "approved" : "pending"} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <div className="mt-3.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <motion.div
              className="h-full rounded-full bg-brand-600"
              initial={{ width: "0%" }}
              animate={{ width: `${violation.confidence}%` }}
              transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-ink-900">
            {violation.confidence}%
          </span>
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-ink-700">
          {violation.reasoning}
        </p>
        <p className="mt-1.5 text-xs text-ink-500">{violation.rule}</p>

        <div className="mt-4 flex gap-2.5">
          <motion.div
            animate={
              approved
                ? { backgroundColor: "rgb(5 150 105)", scale: [1, 1.04, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white"
          >
            {approved ? (
              <>
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </motion.svg>
                Warning issued
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </>
            )}
          </motion.div>
          <motion.div
            animate={{ opacity: approved ? 0.45 : 1 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-700 ring-1 ring-ink-200"
          >
            <XCircle className="h-4 w-4" />
            Dismiss
          </motion.div>
        </div>
      </motion.div>
    </Card>
  );
}

export function DemoReel() {
  const searchParams = useSearchParams();
  const loop = searchParams.get("loop") === "1";

  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cascadeDone, setCascadeDone] = useState(false);
  const [focused, setFocused] = useState(false);
  const [approved, setApproved] = useState(false);
  const [outro, setOutro] = useState(false);

  const pausedRef = useRef(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ref-driven clock: React state changes only at beats, the progress bar
  // is written straight to the DOM, so nothing re-renders per frame.
  useEffect(() => {
    setCascadeDone(false);
    setFocused(false);
    setApproved(false);
    setOutro(false);
    if (progressRef.current) progressRef.current.style.width = "0%";

    const beats: Array<{ at: number; run: () => void }> = [
      { at: 3300, run: () => setCascadeDone(true) },
      { at: 3700, run: () => setFocused(true) },
      { at: 5600, run: () => setApproved(true) },
      { at: 7200, run: () => setFocused(false) },
      { at: 9000, run: () => setOutro(true) },
    ];

    let nextBeat = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let finished = false;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current && !finished) {
        acc += dt;
        while (nextBeat < beats.length && acc >= beats[nextBeat]!.at) {
          beats[nextBeat]!.run();
          nextBeat += 1;
        }
        if (progressRef.current) {
          progressRef.current.style.width = `${Math.min(
            100,
            (acc / CYCLE_MS) * 100
          )}%`;
        }
        if (acc >= CYCLE_MS) {
          if (loop) {
            setRunId((n) => n + 1);
            return;
          }
          finished = true;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [runId, loop]);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-canvas">
      {/* Slow-drifting background so the frame is never fully static */}
      <motion.div
        className="pointer-events-none absolute -top-1/4 left-1/4 h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(circle,rgba(79,127,95,0.12),transparent_65%)]"
        animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-1/3 right-1/5 h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(120,113,108,0.08),transparent_65%)]"
        animate={{ x: [0, -50, 0], y: [0, -25, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {paused ? (
        <div className="absolute right-4 top-4 z-50 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          Paused · Space to resume
        </div>
      ) : null}

      <AnimatePresence mode="sync">
        <motion.div
          key={runId}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.35 } }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          <div className="mx-auto flex h-full min-h-[100dvh] w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between"
            >
              <Logo size="md" href={undefined} />
              <p className="text-xs font-medium tracking-wide text-ink-500">
                Willow Creek Estates · June 25, 2026
              </p>
            </motion.div>

            {/* Stat chips */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <StatChip
                icon={<Home className="h-3.5 w-3.5" />}
                label="homes reviewed"
                value={DEMO_ROWS.length}
                delay={0.15}
                tone="ink"
              />
              <StatChip
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="violations"
                value={VIOLATION_COUNT}
                delay={0.28}
                tone="amber"
              />
              <StatChip
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="clean"
                value={CLEAN_COUNT}
                delay={0.41}
                tone="brand"
              />
            </div>

            {/* Card grid */}
            <motion.div
              variants={gridContainer}
              initial="initial"
              animate="animate"
              className="mt-7 grid flex-1 grid-cols-2 content-start gap-4 lg:grid-cols-3"
              style={{ perspective: 1200 }}
            >
              {DEMO_ROWS.map((row, i) => {
                const isFocused = focused && row.property.id === FOCUS_ROW.property.id;
                const resolved = approved && row.property.id === FOCUS_ROW.property.id;
                return (
                  <motion.div
                    key={row.property.id}
                    className="relative"
                    animate={{
                      opacity: outro ? 0.35 : focused && !isFocused ? 0.55 : 1,
                      scale: outro ? 0.97 : 1,
                    }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Invisible copy keeps the grid cell's size while the
                        real card is morphed into the focus overlay */}
                    <div className="invisible" aria-hidden>
                      <CardShell row={row} resolved={false} />
                    </div>
                    {!isFocused && (
                      <motion.div
                        layoutId={`reel-card-${row.property.id}`}
                        variants={gridItem}
                        initial={cascadeDone ? false : "initial"}
                        animate="animate"
                        transition={morphSpring}
                        className="absolute inset-0"
                      >
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 4.5 + i * 0.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 2 + i * 0.3,
                          }}
                          className="h-full"
                        >
                          <CardShell row={row} resolved={resolved} />
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Focus overlay — same layoutId, so the grid card morphs into it */}
          <AnimatePresence>
            {focused && (
              <motion.div
                key="backdrop"
                className="absolute inset-0 z-30 bg-ink-900/20 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            )}
          </AnimatePresence>
          {focused && (
            <div className="absolute inset-0 z-40 grid place-items-center p-6">
              <motion.div
                layoutId={`reel-card-${FOCUS_ROW.property.id}`}
                transition={morphSpring}
                className="w-full max-w-lg"
              >
                <FocusCard approved={approved} />
              </motion.div>
            </div>
          )}

          {/* Outro */}
          <AnimatePresence>
            {outro && (
              <motion.div
                key="outro"
                className="absolute inset-0 z-40 grid place-items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className="rounded-3xl bg-white/90 px-10 py-8 text-center shadow-card-hover ring-1 ring-ink-200/60 backdrop-blur"
                >
                  <Logo size="lg" href={undefined} className="justify-center" />
                  <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink-900">
                    One drive. Every home reviewed.
                  </p>
                  <p className="mt-2 text-sm text-ink-600">
                    Violations flagged with photo evidence in minutes.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-0.5 bg-ink-200/40">
        <div ref={progressRef} className="h-full bg-brand-600/70" style={{ width: "0%" }} />
      </div>
    </div>
  );
}
