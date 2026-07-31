/**
 * Nova-owned send plan. Hard safety still lives in outreach-policy + env kill
 * switch; this is what Nova sets when it decides "how many today".
 */

import { OUTREACH_MAX_SENDS_PER_DAY } from "@/lib/nexus/outreach-policy";
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
    dailyTarget = 10;
  }
  dailyTarget = Math.min(OUTREACH_MAX_SENDS_PER_DAY, Math.floor(dailyTarget));

  const armedMeta = (armedRow?.metadata ?? {}) as { armed?: boolean };
  const armed =
    typeof armedMeta.armed === "boolean"
      ? armedMeta.armed
      : /^(true|armed|on|yes)/i.test(armedRow?.content ?? "");

  return {
    dailyTarget,
    armed,
    note: planRow?.content ?? null,
  };
}

export async function setNovaSendPlan(input: {
  dailyTarget: number;
  note?: string;
}): Promise<NovaSendPlan> {
  const dailyTarget = Math.max(
    0,
    Math.min(OUTREACH_MAX_SENDS_PER_DAY, Math.floor(input.dailyTarget))
  );
  const note =
    input.note?.trim() ||
    `Nova target: ${dailyTarget} sends/day (hard ceiling ${OUTREACH_MAX_SENDS_PER_DAY}).`;

  await upsertNovaMemory({
    kind: "preference",
    key: PLAN_KEY,
    content: note,
    metadata: {
      dailyTarget,
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
      ? `Armed: ${reason?.trim() || "Nova enabled sending"}`
      : `Paused: ${reason?.trim() || "Nova paused sending"}`,
    metadata: {
      armed,
      reason: reason ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
  return getNovaSendPlan();
}
