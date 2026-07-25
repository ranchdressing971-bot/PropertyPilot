"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import { fadeUp, popIn, staggerContainer, staggerItem } from "@/lib/motion";
import type { Property, Violation } from "@/lib/mock-data";
import clsx from "clsx";

type Scene = "results" | "detail";

type Tab = "violations" | "all";

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

const DETAIL_ROW = DEMO_ROWS[0]!;
const VIOLATION_COUNT = DEMO_ROWS.filter((r) => r.violation).length;
const CLEAN_COUNT = DEMO_ROWS.filter((r) => !r.violation).length;

/**
 * Post-recording results tour (~12.5s). Starts on inspection results.
 * Times are cumulative ms from tour start.
 */
const SCENE_START: Record<Scene, number> = {
  results: 0,
  detail: 8200,
};

const CYCLE_MS = 12500;

const SCENE_ORDER: Scene[] = ["results", "detail"];

function sceneAt(elapsed: number): Scene {
  let current: Scene = "results";
  for (const id of SCENE_ORDER) {
    if (elapsed >= SCENE_START[id]) current = id;
  }
  // Brief return to results before loop (~1s)
  if (elapsed >= 11200) return "results";
  return current;
}

const panelEnter = {
  initial: { opacity: 0, y: 28 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.4, ease: [0.4, 0, 1, 1] as const },
  },
};

function DemoChrome({
  title,
  subtitle,
  children,
  scrollRef,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-full min-h-[100dvh] flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo size="md" href={undefined} />
        <p className="text-xs font-medium tracking-wide text-ink-500">
          Willow Creek Estates
        </p>
      </div>
      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-5 pb-16 sm:px-8"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function DemoResultCard({
  row,
  highlighted,
}: {
  row: DemoRow;
  highlighted: boolean;
}) {
  const { property, violation } = row;

  return (
    <motion.div
      variants={staggerItem}
      layout={false}
      animate={highlighted ? { y: -8, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={clsx(
        "rounded-2xl transition-[box-shadow,ring] duration-500",
        highlighted && "ring-2 ring-brand-500/50 shadow-card-hover"
      )}
      style={{ transformOrigin: "center top" }}
    >
      <Card className="overflow-hidden">
        <div className="relative h-36 w-full overflow-hidden rounded-xl sm:h-40">
          <MediaImage
            src={property.image}
            alt={property.address}
            fill
            className="object-cover"
          />
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold leading-snug text-ink-900 sm:text-base">
              {property.address}
            </h3>
            <Badge status={property.status} />
          </div>

          {violation ? (
            <div className="rounded-xl bg-amber-50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
                Possible violation
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug text-amber-900">
                {violation.type}
              </p>
              <p className="mt-2 text-xs text-amber-900/80">
                {violation.confidence}% confidence · {violation.recommendation}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
              <p className="text-sm font-medium text-brand-800">No violations</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function ResultsScene({
  showCards,
  tab,
  highlightId,
  scrollRef,
  returning,
}: {
  showCards: boolean;
  tab: Tab;
  highlightId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  returning?: boolean;
}) {
  const visibleRows = useMemo(() => {
    if (tab === "violations") return DEMO_ROWS.filter((r) => r.violation);
    return DEMO_ROWS;
  }, [tab]);

  return (
    <DemoChrome
      title="Inspection results"
      subtitle={`June 25, 2026 · ${VIOLATION_COUNT} violations · ${CLEAN_COUNT} clean`}
      scrollRef={scrollRef}
    >
      <motion.div
        initial={returning ? false : popIn.initial}
        animate={popIn.animate}
        transition={popIn.transition(0.05)}
        className="grid max-w-md grid-cols-2 gap-3"
      >
        <Card padding="sm" className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-xs font-medium text-ink-500">Clean</p>
            <p className="text-xl font-semibold text-ink-900">{CLEAN_COUNT}</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-medium text-ink-500">Violations</p>
            <p className="text-xl font-semibold text-ink-900">
              {VIOLATION_COUNT}
            </p>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={returning ? false : fadeUp.initial}
        animate={fadeUp.animate}
        transition={fadeUp.transition(0.1)}
        className="mt-5 flex gap-1.5"
      >
        {(
          [
            {
              id: "violations" as const,
              label: "Violations",
              count: VIOLATION_COUNT,
            },
            { id: "all" as const, label: "All", count: DEMO_ROWS.length },
          ] as const
        ).map((t) => (
          <span
            key={t.id}
            className={clsx(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
              tab === t.id
                ? "bg-ink-900 text-white shadow-sm"
                : "bg-white text-ink-600 ring-1 ring-ink-200"
            )}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{t.count}</span>
          </span>
        ))}
      </motion.div>

      {showCards ? (
        <motion.div
          key={tab}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {visibleRows.map((row) => (
            <DemoResultCard
              key={row.property.id}
              row={row}
              highlighted={highlightId === row.property.id}
            />
          ))}
        </motion.div>
      ) : null}
      {/* Room for auto-scroll */}
      <div className="h-24" aria-hidden />
    </DemoChrome>
  );
}

function DetailScene() {
  const { property, violation } = DETAIL_ROW;
  if (!violation) return null;

  return (
    <DemoChrome title={violation.type} subtitle={property.address}>
      <motion.p
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </motion.p>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
              <MediaImage
                src={property.image}
                alt={property.address}
                fill
                className="object-cover"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge status="pending" />
              <span className="text-xs text-ink-500">
                {violation.confidence}% confidence
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">
              {violation.reasoning}
            </p>
            <p className="mt-2 text-xs text-ink-500">{violation.rule}</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className="space-y-3"
        >
          <Card padding="sm">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Recommendation
            </p>
            <p className="mt-1.5 text-base font-semibold text-ink-900">
              {violation.recommendation}
            </p>
          </Card>

          <div className="flex gap-2.5">
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </div>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-700 ring-1 ring-ink-200">
              <XCircle className="h-4 w-4" />
              Dismiss
            </div>
          </div>
        </motion.div>
      </div>
    </DemoChrome>
  );
}

function smoothScrollTo(
  el: HTMLElement,
  target: number,
  durationMs: number
): () => void {
  const start = el.scrollTop;
  const delta = target - start;
  if (Math.abs(delta) < 1) return () => undefined;

  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    el.scrollTop = start + delta * eased;
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function DemoReel() {
  const searchParams = useSearchParams();
  const loop = searchParams.get("loop") === "1";

  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>("violations");
  const [showCards, setShowCards] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const pausedRef = useRef(false);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const scrollCleanups = useRef<Array<() => void>>([]);
  const beatFired = useRef<Set<string>>(new Set());

  const scene = sceneAt(elapsed);
  const returningToResults = elapsed >= 11200;

  const clearScrolls = useCallback(() => {
    scrollCleanups.current.forEach((fn) => fn());
    scrollCleanups.current = [];
  }, []);

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

  // Master clock
  useEffect(() => {
    setElapsed(0);
    setTab("violations");
    setShowCards(false);
    setHighlightId(null);
    beatFired.current = new Set();
    clearScrolls();
    if (resultsScrollRef.current) resultsScrollRef.current.scrollTop = 0;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let finished = false;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current && !finished) {
        acc += dt;
        if (acc >= CYCLE_MS) {
          if (loop) {
            setRunId((n) => n + 1);
            return;
          }
          acc = CYCLE_MS;
          finished = true;
          setElapsed(CYCLE_MS);
        } else {
          setElapsed(acc);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearScrolls();
    };
  }, [runId, loop, clearScrolls]);

  // Results-local beats
  useEffect(() => {
    const fire = (key: string, fn: () => void) => {
      if (beatFired.current.has(key)) return;
      beatFired.current.add(key);
      fn();
    };

    if (elapsed >= 350) {
      fire("show-cards", () => setShowCards(true));
    }
    if (elapsed >= 2600) {
      fire("highlight", () => setHighlightId("demo-prop-1"));
    }
    if (elapsed >= 3800) {
      fire("results-scroll", () => {
        const el = resultsScrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 8) {
          scrollCleanups.current.push(smoothScrollTo(el, max * 0.7, 2000));
        }
      });
    }
    if (elapsed >= 6000) {
      fire("tab-all", () => {
        setHighlightId(null);
        setTab("all");
        if (resultsScrollRef.current) {
          resultsScrollRef.current.scrollTop = 0;
        }
      });
    }
    if (elapsed >= 6800) {
      fire("all-scroll", () => {
        const el = resultsScrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 8) {
          scrollCleanups.current.push(smoothScrollTo(el, max * 0.45, 1600));
        }
      });
    }
    if (elapsed >= 11200) {
      fire("reset-tab", () => {
        setTab("violations");
        setShowCards(true);
        setHighlightId(null);
        if (resultsScrollRef.current) {
          resultsScrollRef.current.scrollTop = 0;
        }
      });
    }
  }, [elapsed]);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,127,95,0.1),transparent_55%)]" />

      {paused ? (
        <div className="absolute right-4 top-4 z-50 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          Paused · Space to resume
        </div>
      ) : null}

      <AnimatePresence mode="sync">
        {scene === "results" && (
          <motion.div
            key={`results-${runId}-${returningToResults ? "back" : "main"}`}
            className="absolute inset-0 overflow-hidden bg-canvas"
            {...panelEnter}
          >
            <ResultsScene
              showCards={showCards}
              tab={tab}
              highlightId={highlightId}
              scrollRef={resultsScrollRef}
              returning={returningToResults}
            />
          </motion.div>
        )}

        {scene === "detail" && (
          <motion.div
            key={`detail-${runId}`}
            className="absolute inset-0 overflow-hidden bg-canvas"
            {...panelEnter}
          >
            <DetailScene />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-0.5 bg-ink-200/40">
        <div
          className="h-full bg-brand-600/70 transition-[width] duration-100 ease-linear"
          style={{
            width: `${Math.min(100, (elapsed / CYCLE_MS) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
