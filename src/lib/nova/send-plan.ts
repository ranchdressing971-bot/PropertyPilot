/**
 * Nova-owned send plan. She chooses daily volume (usually 20–50).
 * Hard safety still lives in outreach-policy + env kill switch.
 */

import {
  clampDailySendTarget,
  OUTREACH_MIN_SENDS_PER_DAY,
  outreachMaxSendsPerDay,
} from "@/lib/nexus/outreach-policy";
import { loadNovaMemories, upsertNovaMemory } from "./memory";

export interface NovaSendPlan {
  /** How many emails Nova wants to send today. */
  dailyTarget: number;
  /** Soft arm — Nova can pause without redeploying. Env kill switch still wins. */
  armed: boolean;
  note: string | null;
}

const PLAN_KEY = "outreach.send_plan";
const ARMED_KEY = "outreach.armed";

export async function getNovaSendPlan(): Promise<NovaSendPlan> {
  const memories = await loadNovaMemories(40);
  const planRow = memories.find((m) => m.key === PLAN_KEY);
  const armedRow = memories.find((m) => m.key === ARMED_KEY);

  const meta = (planRow?.metadata ?? {}) as { dailyTarget?: number };
  let dailyTarget =
    typeof meta.dailyTarget === "number"
      ? meta.dailyTarget
      : Number.parseInt(planRow?.content?.match(/\d+/)?.[0] ?? "", 10);

  if (!Number.isFinite(dailyTarget) || dailyTarget < 0) {
    dailyTarget = OUTREACH_MIN_SENDS_PER_DAY;
  }
  dailyTarget = clampDailySendTarget(dailyTarget);

  const armedMeta = (armedRow?.metadata ?? {}) as { armed?: boolean };
  const armed =
    typeof armedMeta.armed === "boolean"
      ? armedMeta.armed
      : armedRow
        ? /^(true|armed|on|yes|running|autonomous)/i.test(
            armedRow.content ?? ""
          )
        : true;

  return {
    dailyTarget,
    armed,
    note: planRow?.content ?? null,
  };
}

export async function setNovaSendPlan(input: {
  dailyTarget: number;
  note?: string;
  planDay?: string;
}): Promise<NovaSendPlan> {
  const dailyTarget = clampDailySendTarget(input.dailyTarget);
  const max = outreachMaxSendsPerDay();
  const note =
    input.note?.trim() ||
    (dailyTarget === 0
      ? "Paused (0 sends today)."
      : `Nova target: ${dailyTarget}/day (floor ${OUTREACH_MIN_SENDS_PER_DAY}, ceiling ${max}).`);

  await upsertNovaMemory({
    kind: "preference",
    key: PLAN_KEY,
    content: note,
    metadata: {
      dailyTarget,
      planDay: input.planDay ?? null,
      updatedAt: new Date().toISOString(),
    },
  });

  const current = await getNovaSendPlan();
  return { ...current, dailyTarget, note };
}

export async function setNovaSendArmed(
  armed: boolean,
  reason?: string
): Promise<NovaSendPlan> {
  await upsertNovaMemory({
    kind: "preference",
    key: ARMED_KEY,
    content: armed
      ? `Running: ${reason?.trim() || "Nova autonomous outreach"}`
      : `Paused: ${reason?.trim() || "Nova paused sending"}`,
    metadata: {
      armed,
      reason: reason ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
  return getNovaSendPlan();
}
