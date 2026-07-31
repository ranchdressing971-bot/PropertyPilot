/**
 * Nova's autonomous daily outreach plan — volume, timing bias, draft priority.
 * Runs on each background tick; Isaac can still pause or override via send_today.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { detectMessageThemes } from "./conversions";
import { loadNovaMemories } from "./memory";
import {
  getNovaSendPlan,
  setNovaSendArmed,
  setNovaSendPlan,
  type NovaSendPlan,
} from "./send-plan";
import {
  isNexusSendEnabled,
  nextOutreachSendDelaySeconds,
  OUTREACH_MIN_SENDS_PER_DAY,
  OUTREACH_TZ,
  OUTREACH_WINDOW_END_HOUR,
  OUTREACH_WINDOW_START_HOUR,
  outreachMaxSendsPerDay,
} from "@/lib/nexus/outreach-policy";

export interface LearnHints {
  sentCount: number;
  matchedCount: number;
  conversionRate: number;
  topThemes: string[];
  bestHoursEt: number[];
}

export interface DailyTargetResult {
  target: number;
  note: string;
}

export interface ApprovedDraftRow {
  id: string;
  subject: string;
  body: string;
  confidence: number | null;
  created_at: string;
}

function etDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OUTREACH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function etHour(date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: OUTREACH_TZ,
    hour: "numeric",
    hour12: false,
  }).format(date);
  const hour = Number(hourStr);
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Load learn/strategy hints Nova already persisted. */
export async function loadLearnHints(): Promise<LearnHints> {
  const memories = await loadNovaMemories(40);
  const learning = memories.find((m) => m.key === "outreach.learning");
  const strategy = memories.find((m) => m.key === "outreach.strategy");
  const meta = (learning?.metadata ?? {}) as {
    sentCount?: number;
    matchedCount?: number;
    conversionRate?: number;
    topThemesConverted?: string[];
    bestHoursEt?: number[];
  };

  const topFromMeta = meta.topThemesConverted ?? [];
  const topFromStrategy = parseThemesFromStrategy(strategy?.content ?? "");

  return {
    sentCount: meta.sentCount ?? 0,
    matchedCount: meta.matchedCount ?? 0,
    conversionRate:
      typeof meta.conversionRate === "number" ? meta.conversionRate : 0,
    topThemes: [...new Set([...topFromMeta, ...topFromStrategy])].slice(0, 5),
    bestHoursEt: (meta.bestHoursEt ?? []).filter(
      (h) =>
        Number.isFinite(h) &&
        h >= OUTREACH_WINDOW_START_HOUR &&
        h < OUTREACH_WINDOW_END_HOUR
    ),
  };
}

function parseThemesFromStrategy(content: string): string[] {
  const match = content.match(/Double down on "([^"]+)"/i);
  return match?.[1] ? [match[1]] : [];
}

/**
 * Nova picks today's volume from approved inventory + learn signal + hard cap.
 * Prefers quality over blasting when data is thin.
 */
export function computeNovaDailyTarget(input: {
  approvedCount: number;
  sentToday: number;
  hints: LearnHints;
}): DailyTargetResult {
  const max = outreachMaxSendsPerDay();
  const floor = OUTREACH_MIN_SENDS_PER_DAY;
  const { approvedCount, sentToday, hints } = input;
  const remainingCap = Math.max(0, max - sentToday);

  if (approvedCount === 0) {
    return {
      target: 0,
      note: "No approved drafts — holding until the pipeline catches up.",
    };
  }

  if (remainingCap <= 0) {
    return {
      target: 0,
      note: `Daily cap (${max}) reached — resuming next window.`,
    };
  }

  let target = floor;

  if (hints.sentCount < 20 || hints.matchedCount === 0) {
    target = floor;
  } else if (hints.conversionRate >= 2 || hints.matchedCount >= 3) {
    target = Math.min(max, Math.max(floor, Math.ceil(max * 0.75)));
  } else {
    target = floor;
  }

  target = Math.min(target, approvedCount, remainingCap);

  if (target <= 0) {
    return {
      target: 0,
      note: "Nothing to queue right now.",
    };
  }

  const qualityNote =
    hints.sentCount < 20 || hints.matchedCount === 0
      ? "Learn data thin — staying at floor volume for quality."
      : hints.conversionRate >= 2
        ? "Good convert signal — scaling toward ceiling."
        : "Steady floor volume while we gather more signal.";

  const themeNote =
    hints.topThemes.length > 0
      ? ` Prioritizing ${hints.topThemes.slice(0, 2).join(", ")} drafts.`
      : "";

  return {
    target,
    note: `Autonomous plan: ${target} today (${qualityNote}).${themeNote}`,
  };
}

/** Score approved drafts — higher confidence + strategy theme match wins. */
export function scoreDraftForSend(
  draft: ApprovedDraftRow,
  hints: LearnHints
): number {
  let score = draft.confidence ?? 50;
  const themes = detectMessageThemes(draft.subject, draft.body);
  for (const theme of hints.topThemes) {
    if (themes.includes(theme)) score += 15;
  }
  return score;
}

export function sortApprovedDrafts(
  drafts: ApprovedDraftRow[],
  hints: LearnHints
): ApprovedDraftRow[] {
  return [...drafts].sort((a, b) => {
    const diff = scoreDraftForSend(b, hints) - scoreDraftForSend(a, hints);
    if (diff !== 0) return diff;
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });
}

/**
 * Delay with optional bias toward learn's best ET hours (still inside 10–3 window).
 */
export function outreachSendDelayWithBias(
  bestHoursEt: number[] = [],
  random: () => number = Math.random
): number {
  const base = nextOutreachSendDelaySeconds(random);
  if (bestHoursEt.length === 0) return base;

  const hour = etHour();
  const preferred = bestHoursEt
    .filter(
      (h) =>
        h >= OUTREACH_WINDOW_START_HOUR && h < OUTREACH_WINDOW_END_HOUR
    )
    .sort((a, b) => a - b);

  if (preferred.length === 0) return base;

  const targetHour = preferred[0];
  if (hour >= targetHour) return base;

  const biasSeconds = (targetHour - hour) * 3600 + Math.floor(random() * 900);
  return base + biasSeconds;
}

async function countApprovedDrafts(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("nexus_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  if (error || count == null) return 0;
  return count;
}

export async function loadApprovedDraftsForSend(
  db: SupabaseClient,
  limit: number,
  hints: LearnHints
): Promise<ApprovedDraftRow[]> {
  const { data, error } = await db
    .from("nexus_drafts")
    .select("id, subject, body, confidence, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error || !data) return [];
  return sortApprovedDrafts(data as ApprovedDraftRow[], hints);
}

export interface AutonomyRefreshResult {
  plan: NovaSendPlan;
  refreshed: boolean;
  reason?: string;
}

/**
 * On each tick: refresh today's target when armed, keep Nova running by default.
 * Explicit pause (armed=false) is respected until Isaac resumes.
 */
export async function ensureNovaDailyAutonomy(
  db: SupabaseClient
): Promise<AutonomyRefreshResult> {
  const plan = await getNovaSendPlan();

  if (!plan.armed) {
    return { plan, refreshed: false, reason: "paused" };
  }

  const today = etDayKey();
  const memories = await loadNovaMemories(40);
  const planRow = memories.find((m) => m.key === "outreach.send_plan");
  const planMeta = (planRow?.metadata ?? {}) as {
    planDay?: string;
    dailyTarget?: number;
  };
  const planDay = planMeta.planDay ?? null;

  const approvedCount = await countApprovedDrafts(db);
  const hints = await loadLearnHints();
  const { countSentToday } = await import("@/lib/nexus/hands/send");
  const sentToday = await countSentToday(db);
  const computed = computeNovaDailyTarget({ approvedCount, sentToday, hints });

  const needsRefresh =
    planDay !== today || plan.dailyTarget !== computed.target;

  if (!needsRefresh) {
    return { plan, refreshed: false };
  }

  await setNovaSendPlan({
    dailyTarget: computed.target,
    note: computed.note,
    planDay: today,
  });

  if (isNexusSendEnabled() && computed.target > 0) {
    await setNovaSendArmed(true, "Autonomous daily plan");
  }

  return {
    plan: await getNovaSendPlan(),
    refreshed: true,
  };
}
