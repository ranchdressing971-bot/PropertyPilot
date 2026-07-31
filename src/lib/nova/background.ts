import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOutreachSend, countQueuedSends, countSentToday } from "@/lib/nexus/hands/send";
import {
  isMailtrapSandbox,
  isWithinOutreachWindow,
} from "@/lib/nexus/outreach-policy";
import { loadConversionReport } from "./conversions";
import { loadNovaMemories } from "./memory";
import { persistNovaLearning } from "./learning-persist";
import { getNovaSendPlan } from "./send-plan";

/**
 * Nova background autonomy — runs inside the Nexus tick (GitHub Action every
 * 10 min). Keeps send queue topped up and refreshes learning while the UI is
 * closed. Does not bypass arm, approve, or env kill-switch gates.
 */

const LEARN_INTERVAL_MS = 6 * 3600_000;

export interface NovaBackgroundResult {
  sendReplenish: {
    skipped: boolean;
    reason?: string;
    queued: number;
    sentToday: number;
    queuedSends: number;
    dailyTarget: number;
  };
  learn: {
    skipped: boolean;
    reason?: string;
    ran: boolean;
    sentCount?: number;
    matchedCount?: number;
  };
}

async function shouldRunBackgroundLearn(): Promise<boolean> {
  const memories = await loadNovaMemories(40);
  const row = memories.find((m) => m.key === "outreach.learning");
  if (!row) return true;

  const at = (row.metadata as { at?: string }).at;
  if (!at) return true;

  const elapsed = Date.now() - new Date(at).getTime();
  if (elapsed >= LEARN_INTERVAL_MS) return true;

  const lastSent = (row.metadata as { sentCount?: number }).sentCount ?? 0;
  const summary = await loadConversionReport({ sinceDays: 90, limit: 1, syncWins: false });
  return summary.sentCount > lastSent;
}

/**
 * Queue approved drafts up to Nova's daily target when she is armed.
 */
export async function replenishNovaSendQueue(
  db: SupabaseClient
): Promise<NovaBackgroundResult["sendReplenish"]> {
  const plan = await getNovaSendPlan();

  if (!plan.armed || plan.dailyTarget <= 0) {
    return {
      skipped: true,
      reason: "nova_disarmed",
      queued: 0,
      sentToday: 0,
      queuedSends: 0,
      dailyTarget: plan.dailyTarget,
    };
  }

  const sandbox = isMailtrapSandbox();
  if (!sandbox && !isWithinOutreachWindow()) {
    return {
      skipped: true,
      reason: "outside_send_window",
      queued: 0,
      sentToday: await countSentToday(db),
      queuedSends: await countQueuedSends(db),
      dailyTarget: plan.dailyTarget,
    };
  }

  const sentToday = await countSentToday(db);
  const queuedSends = await countQueuedSends(db);
  const pipeline = sentToday + queuedSends;
  const headroom = Math.max(0, plan.dailyTarget - pipeline);

  if (headroom <= 0) {
    return {
      skipped: true,
      reason: "daily_target_met",
      queued: 0,
      sentToday,
      queuedSends,
      dailyTarget: plan.dailyTarget,
    };
  }

  const { data } = await db
    .from("nexus_drafts")
    .select("id")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(Math.min(headroom, 50));

  const approved = data ?? [];
  let queued = 0;
  for (const row of approved) {
    await enqueueOutreachSend(row.id, db);
    queued += 1;
  }

  return {
    skipped: false,
    queued,
    sentToday,
    queuedSends,
    dailyTarget: plan.dailyTarget,
  };
}

/**
 * Refresh learning dossier and strategy notes (throttled).
 */
export async function runNovaBackgroundLearn(): Promise<
  NovaBackgroundResult["learn"]
> {
  const due = await shouldRunBackgroundLearn();
  if (!due) {
    return { skipped: true, reason: "throttled", ran: false };
  }

  const report = await loadConversionReport({
    sinceDays: 90,
    limit: 15,
    syncWins: true,
  });

  await persistNovaLearning(report);

  return {
    skipped: false,
    ran: true,
    sentCount: report.sentCount,
    matchedCount: report.matchedCount,
  };
}

/** Called at the start of each Nexus tick. */
export async function runNovaBackgroundTasks(
  db: SupabaseClient
): Promise<NovaBackgroundResult> {
  const [sendReplenish, learn] = await Promise.all([
    replenishNovaSendQueue(db),
    runNovaBackgroundLearn(),
  ]);
  return { sendReplenish, learn };
}
