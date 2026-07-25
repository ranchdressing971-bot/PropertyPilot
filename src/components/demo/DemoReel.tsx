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
  ArrowRight,
  CheckCircle2,
  Film,
  Home,
  MapPin,
  Upload,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import { fadeUp, popIn, staggerContainer, staggerItem } from "@/lib/motion";
import type { Property, Violation } from "@/lib/mock-data";
import clsx from "clsx";

type Scene =
  | "landing"
  | "upload"
  | "results"
  | "violations"
  | "properties"
  | "cta";

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

const UPLOAD_FRAMES = [
  { src: "/demo/demo-clean-home.jpg", label: "456 Oak" },
  { src: "/demo/demo-trash-bin.jpg", label: "123 Main" },
  { src: "/demo/demo-tall-grass.jpg", label: "789 Pine" },
  { src: "/demo/demo-debris.jpg", label: "234 Cedar" },
  { src: "/demo/demo-dead-landscaping.jpg", label: "654 Aspen" },
];

const VIOLATION_COUNT = DEMO_ROWS.filter((r) => r.violation).length;
const CLEAN_COUNT = DEMO_ROWS.filter((r) => !r.violation).length;

/**
 * Full product-tour timeline (~30s). Scenes crossfade (enter-led, no wait gap).
 * Times are cumulative ms from tour start.
 */
const SCENE_START: Record<Scene, number> = {
  landing: 0,
  upload: 4200,
  results: 9200,
  violations: 16500,
  properties: 22500,
  cta: 27500,
};

const CYCLE_MS = 32000;

const SCENE_ORDER: Scene[] = [
  "landing",
  "upload",
  "results",
  "violations",
  "properties",
  "cta",
];

function sceneAt(elapsed: number): Scene {
  let current: Scene = "landing";
  for (const id of SCENE_ORDER) {
    if (elapsed >= SCENE_START[id]) current = id;
  }
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

function LandingScene() {
  return (
    <div className="relative flex min-h-[100dvh] items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,127,95,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-28 h-80 w-80 rounded-full bg-copper-500/12 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Logo size="lg" href={undefined} className="mb-8" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5 }}
            className="font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl"
          >
            One drive.
            <br />
            <span className="text-brand-700">Whole street</span> reviewed.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
            className="mt-5 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg"
          >
            Drive-through video in. AI flags homes that need review. You approve
            before anything goes out.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.4 }}
            className="mt-7 space-y-2 text-sm text-ink-600"
          >
            {[
              "Match house numbers from your footage",
              "Evidence frames + confidence on every flag",
              "Clean review list for your whole community",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                {line}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="grid grid-cols-2 gap-3"
        >
          {UPLOAD_FRAMES.slice(0, 4).map((frame, i) => (
            <motion.div
              key={frame.src + i}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-ink-200/70"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.src}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/70 to-transparent px-3 pb-2.5 pt-8">
                <p className="text-xs font-medium text-white">{frame.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function UploadScene({ elapsedInScene }: { elapsedInScene: number }) {
  const framesVisible = Math.min(
    UPLOAD_FRAMES.length,
    Math.floor(elapsedInScene / 550) + 1
  );
  const analyzeProgress = Math.min(
    1,
    Math.max(0, (elapsedInScene - 1800) / 2400)
  );
  const stepIdx =
    analyzeProgress < 0.25
      ? 0
      : analyzeProgress < 0.55
        ? 1
        : analyzeProgress < 0.85
          ? 2
          : 3;
  const steps = [
    "Reading drive-through frames…",
    "Matching mailbox numbers…",
    "Running compliance checks…",
    "Building your review list…",
  ];

  return (
    <div className="relative flex min-h-[100dvh] items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_20%,rgba(79,127,95,0.12),transparent_50%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={fadeUp.transition(0)}
          className="mb-8 flex items-center justify-between"
        >
          <Logo size="md" href={undefined} />
          <span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600 ring-1 ring-ink-200">
            New inspection
          </span>
        </motion.div>

        <Card className="overflow-hidden">
          <div className="flex items-start gap-4 border-b border-ink-100 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200/70">
              {analyzeProgress > 0.05 ? (
                <Film className="h-5 w-5" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold text-ink-900">
                Willow Creek · June 25 drive
              </p>
              <p className="mt-1 text-sm text-ink-500">
                maple-lane-drivethrough.mp4 · ~4:12
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
              Evidence frames
            </p>
            <div className="mt-3 flex gap-2.5 overflow-hidden">
              {UPLOAD_FRAMES.map((frame, i) => {
                const show = i < framesVisible;
                return (
                  <motion.div
                    key={frame.label}
                    initial={false}
                    animate={
                      show
                        ? { opacity: 1, y: 0, scale: 1 }
                        : { opacity: 0.15, y: 12, scale: 0.96 }
                    }
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink-200/80"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frame.src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {show ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-ink-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {frame.label}
                      </span>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-ink-800">{steps[stepIdx]}</p>
              <p className="tabular-nums text-ink-500">
                {Math.round(analyzeProgress * 100)}%
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                animate={{ width: `${Math.round(analyzeProgress * 100)}%` }}
                transition={{ ease: "easeOut", duration: 0.25 }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ResultsScene({
  showCards,
  tab,
  highlightId,
  scrollRef,
}: {
  showCards: boolean;
  tab: Tab;
  highlightId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
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
        initial={popIn.initial}
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
        initial={fadeUp.initial}
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
    </DemoChrome>
  );
}

function ViolationsScene({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const rows = DEMO_ROWS.filter((r) => r.violation);

  return (
    <DemoChrome
      title="Violations"
      subtitle={`${VIOLATION_COUNT} pending · ready for manager review`}
      scrollRef={scrollRef}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pending review", value: String(VIOLATION_COUNT), tone: "amber" },
          { label: "Avg confidence", value: "90%", tone: "brand" },
          { label: "Neighborhoods", value: "1", tone: "ink" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
          >
            <Card padding="sm">
              <p className="text-xs font-medium text-ink-500">{stat.label}</p>
              <p
                className={clsx(
                  "mt-1 text-2xl font-semibold tabular-nums",
                  stat.tone === "amber" && "text-amber-800",
                  stat.tone === "brand" && "text-brand-800",
                  stat.tone === "ink" && "text-ink-900"
                )}
              >
                {stat.value}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((row, i) => {
          const v = row.violation!;
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <Card padding="sm" className="flex items-center gap-4">
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                  <MediaImage
                    src={row.property.image}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {row.property.address}
                    </p>
                    <Badge status="pending" />
                  </div>
                  <p className="mt-1 text-sm text-amber-800">{v.type}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {v.confidence}% confidence · {v.rule}
                  </p>
                </div>
                <AlertTriangle className="hidden h-5 w-5 shrink-0 text-amber-500 sm:block" />
              </Card>
            </motion.div>
          );
        })}
        {/* Extra height so auto-scroll has room to reveal the list */}
        <div className="h-40" aria-hidden />
      </div>
    </DemoChrome>
  );
}

function PropertiesScene({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <DemoChrome
      title="Properties"
      subtitle="Willow Creek Estates · 6 homes covered this run"
      scrollRef={scrollRef}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Home, label: "Properties", value: "6" },
          { icon: MapPin, label: "Streets covered", value: "4" },
          { icon: CheckCircle2, label: "In good standing", value: String(CLEAN_COUNT) },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.4 }}
          >
            <Card padding="sm" className="flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-brand-600" />
              <div>
                <p className="text-xs font-medium text-ink-500">{stat.label}</p>
                <p className="text-xl font-semibold text-ink-900">{stat.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEMO_ROWS.map((row, i) => (
          <motion.div
            key={row.property.id}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
          >
            <Card padding="sm" className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <MediaImage
                  src={row.property.image}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {row.property.address}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {row.property.neighborhood}
                </p>
                <div className="mt-1.5">
                  <Badge status={row.property.status} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="h-32" aria-hidden />
    </DemoChrome>
  );
}

function CtaScene() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(79,127,95,0.2),transparent_60%)]" />
      <div className="pointer-events-none absolute -left-16 bottom-20 h-72 w-72 rounded-full bg-copper-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-xl px-5 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex justify-center"
        >
          <Logo size="lg" href={undefined} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="mt-8 font-display text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl"
        >
          1 free inspection
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45 }}
          className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg"
        >
          Film your next drive-through. Get a clean review list for your
          community — no card required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4 }}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-700/20"
        >
          Start free
          <ArrowRight className="h-4 w-4" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-5 text-sm text-ink-500"
        >
          rideby.app
        </motion.p>
      </div>
    </div>
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
  const violationsScrollRef = useRef<HTMLDivElement>(null);
  const propertiesScrollRef = useRef<HTMLDivElement>(null);
  const scrollCleanups = useRef<Array<() => void>>([]);
  const beatFired = useRef<Set<string>>(new Set());

  const scene = sceneAt(elapsed);
  const uploadElapsed = Math.max(0, elapsed - SCENE_START.upload);

  const clearScrolls = useCallback(() => {
    scrollCleanups.current.forEach((fn) => fn());
    scrollCleanups.current = [];
  }, []);

  // Pause with Space (ref so the clock effect does not restart)
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
    if (violationsScrollRef.current) violationsScrollRef.current.scrollTop = 0;
    if (propertiesScrollRef.current) propertiesScrollRef.current.scrollTop = 0;

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

  // Scene-local beats (cards, tabs, highlight, scrolls)
  useEffect(() => {
    const fire = (key: string, fn: () => void) => {
      if (beatFired.current.has(key)) return;
      beatFired.current.add(key);
      fn();
    };

    if (elapsed >= SCENE_START.results + 400) {
      fire("show-cards", () => setShowCards(true));
    }
    if (elapsed >= SCENE_START.results + 2800) {
      fire("highlight", () => setHighlightId("demo-prop-1"));
    }
    if (elapsed >= SCENE_START.results + 4200) {
      fire("tab-all", () => {
        setHighlightId(null);
        setTab("all");
      });
    }
    if (elapsed >= SCENE_START.results + 4800) {
      fire("results-scroll", () => {
        const el = resultsScrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 8) {
          scrollCleanups.current.push(smoothScrollTo(el, max * 0.55, 2200));
        }
      });
    }
    if (elapsed >= SCENE_START.violations + 900) {
      fire("violations-scroll", () => {
        const el = violationsScrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 8) {
          scrollCleanups.current.push(smoothScrollTo(el, max * 0.85, 2800));
        }
      });
    }
    if (elapsed >= SCENE_START.properties + 700) {
      fire("properties-scroll", () => {
        const el = propertiesScrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 8) {
          scrollCleanups.current.push(smoothScrollTo(el, max * 0.75, 2400));
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
        {scene === "landing" && (
          <motion.div
            key={`landing-${runId}`}
            className="absolute inset-0 bg-canvas"
            {...panelEnter}
          >
            <LandingScene />
          </motion.div>
        )}

        {scene === "upload" && (
          <motion.div
            key={`upload-${runId}`}
            className="absolute inset-0 bg-canvas"
            {...panelEnter}
          >
            <UploadScene elapsedInScene={uploadElapsed} />
          </motion.div>
        )}

        {scene === "results" && (
          <motion.div
            key={`results-${runId}`}
            className="absolute inset-0 overflow-hidden bg-canvas"
            {...panelEnter}
          >
            <ResultsScene
              showCards={showCards}
              tab={tab}
              highlightId={highlightId}
              scrollRef={resultsScrollRef}
            />
          </motion.div>
        )}

        {scene === "violations" && (
          <motion.div
            key={`violations-${runId}`}
            className="absolute inset-0 overflow-hidden bg-canvas"
            {...panelEnter}
          >
            <ViolationsScene scrollRef={violationsScrollRef} />
          </motion.div>
        )}

        {scene === "properties" && (
          <motion.div
            key={`properties-${runId}`}
            className="absolute inset-0 overflow-hidden bg-canvas"
            {...panelEnter}
          >
            <PropertiesScene scrollRef={propertiesScrollRef} />
          </motion.div>
        )}

        {scene === "cta" && (
          <motion.div
            key={`cta-${runId}`}
            className="absolute inset-0 bg-canvas"
            {...panelEnter}
          >
            <CtaScene />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle progress bar for recording awareness */}
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
