"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, animate, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Home, XCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import type { Property, Violation } from "@/lib/mock-data";

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
      reasoning: "Lawn height well above the community standard.",
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
      reasoning: "Construction debris visible in the driveway.",
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
      reasoning: "Front yard landscaping is dead or dying.",
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

const REEL_IMAGES = [
  "/demo/demo-clean-home.jpg",
  "/demo/demo-trash-bin.jpg",
  "/demo/demo-tall-grass.jpg",
  "/demo/demo-debris.jpg",
  "/demo/demo-dead-landscaping.jpg",
];

const ROSTER_STATUSES = [
  "Needs Review",
  "Good Standing",
  "Needs Review",
  "Good Standing",
  "Violation Sent",
  "Good Standing",
  "Resolved",
  "Good Standing",
  "Needs Review",
  "Good Standing",
  "Good Standing",
  "Violation Sent",
  "Good Standing",
  "Resolved",
  "Good Standing",
  "Needs Review",
] as const;

const ROSTER = [
  "123 Main St",
  "456 Oak Drive",
  "789 Pine Lane",
  "101 Maple Court",
  "234 Cedar Way",
  "567 Birch Blvd",
  "890 Willow Path",
  "321 Elm Street",
  "654 Aspen Circle",
  "987 Spruce Avenue",
  "147 Cherry Lane",
  "258 Walnut Drive",
  "369 Hickory Road",
  "741 Sycamore Place",
  "852 Magnolia Dr",
  "963 Dogwood Ct",
].map((address, i) => ({
  id: `roster-${i}`,
  address,
  image: REEL_IMAGES[i % REEL_IMAGES.length]!,
  status: ROSTER_STATUSES[i]!,
}));

/**
 * Vertical (9:16) reel, ~16s. Full-screen panels swipe up:
 * intro -> three quick violations -> flagged home approved ->
 * slow scroll through the full property roster -> outro.
 * Transform/opacity only so it stays smooth on phones.
 */
const TIMELINE = [
  { id: "intro", at: 0 },
  { id: "v1", at: 2700 },
  { id: "v2", at: 4000 },
  { id: "v3", at: 5300 },
  { id: "focus", at: 6600 },
  { id: "properties", at: 9600 },
  { id: "outro", at: 14200 },
] as const;

type SceneId = (typeof TIMELINE)[number]["id"];

const APPROVE_AT = 8000;
const PROPERTIES_SCROLL_MS = 4200;
const CYCLE_MS = 16000;

function ReelImage({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

function CountUp({
  value,
  delay,
  className,
}: {
  value: number;
  delay: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(0, value, {
      delay,
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, delay]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

function IntroScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-7 pb-16 text-center">
      <motion.p
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
        className="text-sm font-medium uppercase tracking-[0.2em] text-brand-700"
      >
        Drive-through inspection
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 280, damping: 24 }}
        className="mt-4 font-display text-[2.7rem] font-semibold leading-[1.04] tracking-tight text-ink-900"
      >
        One drive.
      </motion.h1>
      <motion.h1
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, type: "spring", stiffness: 280, damping: 24 }}
        className="font-display text-[2.7rem] font-semibold leading-[1.04] tracking-tight text-ink-900"
      >
        Every home reviewed.
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.0, type: "spring", stiffness: 300, damping: 24 }}
        className="mt-9 flex items-center gap-2"
      >
        {(
          [
            {
              icon: <Home className="h-3.5 w-3.5 text-ink-500" />,
              value: DEMO_ROWS.length,
              label: "homes",
            },
            {
              icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
              value: VIOLATION_COUNT,
              label: "flagged",
            },
            {
              icon: <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />,
              value: CLEAN_COUNT,
              label: "clean",
            },
          ] as const
        ).map((chip, i) => (
          <div
            key={chip.label}
            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 shadow-sm ring-1 ring-ink-200/70"
          >
            {chip.icon}
            <CountUp
              value={chip.value}
              delay={1.15 + i * 0.12}
              className="text-sm font-semibold tabular-nums text-ink-900"
            />
            <span className="text-sm text-ink-500">{chip.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ViolationScene({
  row,
  step,
  holdMs,
  focus = false,
  approved = false,
}: {
  row: DemoRow;
  step: string;
  holdMs: number;
  focus?: boolean;
  approved?: boolean;
}) {
  const { property, violation } = row;
  if (!violation) return null;

  return (
    <div className="flex h-full flex-col px-5 pb-8 pt-[76px]">
      <div className="relative w-full shrink-0 basis-[46%] overflow-hidden rounded-3xl shadow-card">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.14 }}
          animate={{ scale: 1.03 }}
          transition={{ duration: holdMs / 1000 + 0.5, ease: "easeOut" }}
        >
          <ReelImage src={property.image ?? ""} alt={property.address} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.3 }}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Possible violation
        </motion.div>

        <div className="absolute bottom-3.5 right-3.5 rounded-full bg-ink-900/75 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white">
          {step}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, type: "spring", stiffness: 300, damping: 26 }}
        className="mt-6"
      >
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          {violation.type}
        </h2>
        <p className="mt-1.5 text-sm text-ink-500">
          {property.address} · {property.neighborhood}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <motion.div
              className="h-full rounded-full bg-brand-600"
              initial={{ width: "0%" }}
              animate={{ width: `${violation.confidence}%` }}
              transition={{ delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-ink-900">
            {violation.confidence}%
          </span>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
          {violation.reasoning}
        </p>
        <p className="mt-1.5 text-xs text-ink-500">
          {violation.rule} · {violation.recommendation}
        </p>
      </motion.div>

      {focus ? (
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 26 }}
          className="mt-auto flex gap-2.5"
        >
          <motion.div
            animate={
              approved
                ? { backgroundColor: "rgb(5 150 105)", scale: [1, 1.05, 1] }
                : {}
            }
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3.5 text-[15px] font-semibold text-white"
          >
            {approved ? (
              <>
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px]"
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
                <CheckCircle2 className="h-[18px] w-[18px]" />
                Approve
              </>
            )}
          </motion.div>
          <motion.div
            animate={{ opacity: approved ? 0.4 : 1 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-semibold text-ink-700 ring-1 ring-ink-200"
          >
            <XCircle className="h-[18px] w-[18px]" />
            Dismiss
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}

function PropertiesScene() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  // Measure the overflow so the scroll always lands exactly at the last row,
  // whatever the phone's screen height is.
  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const column = columnRef.current;
      if (!viewport || !column) return;
      setDistance(Math.max(0, column.scrollHeight - viewport.clientHeight));
    };
    measure();
    const t = window.setTimeout(measure, 120);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex h-full flex-col px-5 pb-8 pt-[76px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          Every home, tracked
        </h2>
        <p className="mt-1.5 text-sm text-ink-500">
          {ROSTER.length} homes · Willow Creek Estates
        </p>
      </motion.div>

      <div
        ref={viewportRef}
        className="relative mt-5 flex-1 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 6%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 6%, black 88%, transparent)",
        }}
      >
        <motion.div
          ref={columnRef}
          className="grid grid-cols-2 gap-3"
          animate={{ y: -distance }}
          transition={{
            delay: 0.5,
            duration: PROPERTIES_SCROLL_MS / 1000,
            ease: [0.36, 0, 0.64, 1],
          }}
        >
          {ROSTER.map((home, i) => (
            <motion.div
              key={home.id}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.08 + Math.min(i, 6) * 0.05,
                type: "spring",
                stiffness: 380,
                damping: 27,
              }}
              className="overflow-hidden rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-ink-200/70"
            >
              <div className="relative h-[74px] w-full overflow-hidden rounded-xl bg-ink-100">
                <ReelImage src={home.image} alt={home.address} />
              </div>
              <p className="mt-2 truncate text-[13px] font-semibold text-ink-900">
                {home.address}
              </p>
              <div className="mt-1.5">
                <Badge status={home.status} className="text-[10px]" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function OutroScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-7 pb-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 22 }}
      >
        <Logo size="lg" href={undefined} className="justify-center" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 24 }}
        className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-ink-900"
      >
        Review in minutes,
        <br />
        not weekends.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 280, damping: 24 }}
        className="mt-3 text-[15px] text-ink-600"
      >
        Violations flagged with photo evidence.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        className="mt-8 text-sm font-medium text-ink-500"
      >
        {DEMO_ROWS.length} homes · {VIOLATION_COUNT} flagged · {CLEAN_COUNT} clean
      </motion.p>
    </div>
  );
}

export function DemoReel() {
  const searchParams = useSearchParams();
  const loop = searchParams.get("loop") === "1";

  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scene, setScene] = useState<SceneId>("intro");
  const [approved, setApproved] = useState(false);

  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Warm the image cache so panels never pop in with a gray frame
  useEffect(() => {
    const sources = [
      ...DEMO_ROWS.map((r) => r.property.image),
      ...REEL_IMAGES,
    ];
    sources.forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ref-driven clock: React state changes only when a scene begins, so
  // nothing re-renders per frame while the panels animate.
  useEffect(() => {
    setScene("intro");
    setApproved(false);

    let nextScene = 1;
    let approveFired = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let finished = false;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current && !finished) {
        acc += dt;

        while (nextScene < TIMELINE.length && acc >= TIMELINE[nextScene]!.at) {
          setScene(TIMELINE[nextScene]!.id);
          nextScene += 1;
        }
        if (!approveFired && acc >= APPROVE_AT) {
          approveFired = true;
          setApproved(true);
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

  const sceneContent: Record<SceneId, ReactNode> = {
    intro: <IntroScene />,
    v1: (
      <ViolationScene row={DEMO_ROWS[1]!} step={`1 of ${VIOLATION_COUNT}`} holdMs={1300} />
    ),
    v2: (
      <ViolationScene row={DEMO_ROWS[2]!} step={`2 of ${VIOLATION_COUNT}`} holdMs={1300} />
    ),
    v3: (
      <ViolationScene row={DEMO_ROWS[3]!} step={`3 of ${VIOLATION_COUNT}`} holdMs={1300} />
    ),
    focus: (
      <ViolationScene
        row={DEMO_ROWS[0]!}
        step={`4 of ${VIOLATION_COUNT}`}
        holdMs={2900}
        focus
        approved={approved}
      />
    ),
    properties: <PropertiesScene />,
    outro: <OutroScene />,
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950">
      {/* 9:16 stage — fills a phone screen, letterboxed on desktop */}
      <div
        className="relative h-[100dvh] w-full overflow-hidden bg-canvas"
        style={{ maxWidth: "calc(100dvh * 9 / 16)" }}
      >
        <motion.div
          className="pointer-events-none absolute -top-1/4 left-0 h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(79,127,95,0.12),transparent_65%)]"
          animate={{ x: [0, 50, 0], y: [0, 25, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-5">
          <Logo size="sm" href={undefined} />
          <p className="text-[11px] font-medium tracking-wide text-ink-500">
            Willow Creek Estates
          </p>
        </div>

        {paused ? (
          <div className="absolute right-4 top-16 z-40 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-white">
            Paused · Space to resume
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          <motion.div
            key={`${scene}-${runId}`}
            className="absolute inset-0"
            initial={{ y: 110, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: {
                type: "spring",
                stiffness: 330,
                damping: 30,
                mass: 0.9,
              },
            }}
            exit={{
              y: -70,
              opacity: 0,
              transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
            }}
          >
            {sceneContent[scene]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
