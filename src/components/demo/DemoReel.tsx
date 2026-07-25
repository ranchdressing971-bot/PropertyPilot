"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import { fadeUp, popIn, staggerContainer, staggerItem } from "@/lib/motion";
import type { Property, Violation } from "@/lib/mock-data";
import clsx from "clsx";

type Phase = "analyzing" | "results" | "hold";
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
      reasoning: "",
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

const VIOLATION_COUNT = DEMO_ROWS.filter((r) => r.violation).length;
const CLEAN_COUNT = DEMO_ROWS.filter((r) => !r.violation).length;

/** Total cycle length before optional loop restart. */
const CYCLE_MS = 9200;

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
      animate={
        highlighted
          ? { y: -8, scale: 1.03 }
          : { y: 0, scale: 1 }
      }
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={clsx(
        "rounded-2xl transition-[box-shadow,ring] duration-500",
        highlighted && "ring-2 ring-brand-500/50 shadow-card-hover"
      )}
      style={{ transformOrigin: "center top" }}
    >
      <Card className="overflow-hidden">
        <div className="relative h-36 w-full overflow-hidden rounded-xl sm:h-40">
          <MediaImage src={property.image} alt={property.address} fill className="object-cover" />
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

export function DemoReel() {
  const searchParams = useSearchParams();
  const loop = searchParams.get("loop") === "1";

  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [showHeader, setShowHeader] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [tab, setTab] = useState<Tab>("violations");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    if (tab === "violations") return DEMO_ROWS.filter((r) => r.violation);
    return DEMO_ROWS;
  }, [tab]);

  useEffect(() => {
    setPhase("analyzing");
    setAnalyzeProgress(0);
    setShowHeader(false);
    setShowCards(false);
    setTab("violations");
    setHighlightId(null);

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Progress bar fills during analyzing beat
    const progressStart = performance.now();
    let raf = 0;
    const tickProgress = (now: number) => {
      const t = Math.min(1, (now - progressStart) / 1600);
      setAnalyzeProgress(t);
      if (t < 1) raf = requestAnimationFrame(tickProgress);
    };
    raf = requestAnimationFrame(tickProgress);

    at(1700, () => {
      setPhase("results");
      setShowHeader(true);
    });
    at(2300, () => setShowCards(true));
    at(5200, () => setHighlightId("demo-prop-1"));
    at(6800, () => {
      setHighlightId(null);
      setTab("all");
    });
    at(8600, () => setPhase("hold"));

    if (loop) {
      at(CYCLE_MS, () => setRunId((n) => n + 1));
    }

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [runId, loop]);

  return (
    <div className="pointer-events-none relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,127,95,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-28 h-80 w-80 rounded-full bg-copper-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="md" href={undefined} />
          <p className="text-xs font-medium tracking-wide text-ink-500">
            Willow Creek Estates
          </p>
        </div>

        <AnimatePresence mode="wait">
          {phase === "analyzing" && (
            <motion.div
              key={`analyzing-${runId}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="flex flex-1 flex-col items-center justify-center pb-24"
            >
              <p className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                Analyzing drive-through…
              </p>
              <p className="mt-3 max-w-md text-center text-sm text-ink-600">
                Matching homes, checking evidence frames, and scoring possible violations.
              </p>
              <div className="mt-8 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-ink-200/80">
                <motion.div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.round(analyzeProgress * 100)}%` }}
                />
              </div>
            </motion.div>
          )}

          {(phase === "results" || phase === "hold") && (
            <motion.div
              key={`results-${runId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              {showHeader && (
                <>
                  <motion.div
                    initial={fadeUp.initial}
                    animate={fadeUp.animate}
                    transition={fadeUp.transition(0)}
                  >
                    <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                      Inspection results
                    </h1>
                    <p className="mt-1.5 text-sm text-ink-600">
                      June 25, 2026 · {VIOLATION_COUNT} violations · {CLEAN_COUNT}{" "}
                      clean
                    </p>
                  </motion.div>

                  <motion.div
                    initial={popIn.initial}
                    animate={popIn.animate}
                    transition={popIn.transition(0.08)}
                    className="mt-5 grid max-w-md grid-cols-2 gap-3"
                  >
                    <Card padding="sm" className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
                      <div>
                        <p className="text-xs font-medium text-ink-500">Clean</p>
                        <p className="text-xl font-semibold text-ink-900">
                          {CLEAN_COUNT}
                        </p>
                      </div>
                    </Card>
                    <Card padding="sm" className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-xs font-medium text-ink-500">
                          Violations
                        </p>
                        <p className="text-xl font-semibold text-ink-900">
                          {VIOLATION_COUNT}
                        </p>
                      </div>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={fadeUp.initial}
                    animate={fadeUp.animate}
                    transition={fadeUp.transition(0.14)}
                    className="mt-5 flex gap-1.5"
                  >
                    {(
                      [
                        { id: "violations" as const, label: "Violations", count: VIOLATION_COUNT },
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
                </>
              )}

              {showCards && (
                <motion.div
                  key={`${tab}-${runId}`}
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
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
