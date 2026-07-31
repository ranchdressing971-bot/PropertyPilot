import { enqueueJob, getNexusDb, requireNexusDb } from "@/lib/nexus/jobs";
import { loadNexusState } from "@/lib/nexus/state";
import { enqueueOutreachSend } from "@/lib/nexus/hands/send";
import { isMailtrapConfigured, isMailtrapSandbox } from "@/lib/nexus/mailtrap";
import {
  isNexusSendEnabled,
  isWithinOutreachWindow,
  nextOutreachSendDelaySeconds,
  OUTREACH_MAX_SENDS_PER_DAY,
} from "@/lib/nexus/outreach-policy";
import { runTick } from "@/lib/nexus/runner";
import type { LeadSearchPayload } from "@/lib/nexus/types";
import { upsertNovaMemory } from "./memory";
import {
  getNovaSendPlan,
  setNovaSendArmed,
  setNovaSendPlan,
} from "./send-plan";

/**
 * Small, obvious tools. Nova should not need a playbook to use them.
 *
 * Everyday verbs:
 *   status | find_leads | work | send_today | pause | remember
 */

export const NOVA_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "status",
      description:
        "How outreach is going right now — counts, send plan, blockers, a few drafts/companies.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_leads",
      description:
        'Find HOA management companies. Pass a city like "Austin" or a full query.',
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: 'City name, e.g. "Austin" or "Austin TX"',
          },
          query: {
            type: "string",
            description: "Optional full Places query if you don't want the default",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "work",
      description:
        "Do the next batch of Nexus work (research, draft, review, send jobs already queued).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_today",
      description:
        "ONE call to send N emails today: sets the plan, arms Nova, queues that many approved drafts (paced). Use this when Isaac says send X today.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "How many emails to send today (0–30)",
          },
          note: { type: "string", description: "Optional why" },
        },
        required: ["count"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pause",
      description: "Stop sending. Nova disarms until send_today (or arm) again.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remember",
      description: "Save a note/trial so future Nova sessions know it.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          kind: {
            type: "string",
            enum: ["note", "trial", "preference", "fact"],
          },
        },
        required: ["content"],
      },
    },
  },
];

async function toolStatus() {
  const state = await loadNexusState(40);
  const plan = await getNovaSendPlan();
  const approved = state.drafts.filter((d) => d.status === "approved");
  const sent = state.drafts.filter((d) => d.status === "sent");
  const active = state.companies.filter((c) => c.status === "active");

  const blockers: string[] = [];
  if (!plan.armed) blockers.push("Nova paused (call send_today to arm)");
  if (!isNexusSendEnabled()) blockers.push("env NEXUS_SEND_ENABLED is false");
  if (!isMailtrapConfigured()) blockers.push("Mailtrap not wired yet");
  if (!isMailtrapSandbox() && !isWithinOutreachWindow()) {
    blockers.push("outside 10am–3pm ET send window");
  }

  return {
    summary: {
      leads: active.length,
      contacts: state.contactCount,
      draftsWaiting: state.pendingDraftCount,
      approvedReady: approved.length,
      sent: sent.length,
      jobsQueued: state.queuedCount,
      todayTarget: plan.dailyTarget,
      novaArmed: plan.armed,
    },
    blockers,
    draftPreview: approved.slice(0, 5).map((d) => ({
      to: d.to_email,
      subject: d.subject,
      company: d.company_name,
    })),
    leadPreview: active.slice(0, 5).map((c) => ({
      name: c.name,
      city: c.city,
      reviews: c.metadata?.userRatingCount ?? null,
    })),
  };
}

async function toolFindLeads(args: Record<string, unknown>) {
  const city = String(args.city ?? "").trim();
  const custom = String(args.query ?? "").trim();
  const query =
    custom ||
    (city
      ? `HOA management company in ${city}`
      : "HOA management company in Austin TX");

  const db = requireNexusDb();
  const job = await enqueueJob(
    {
      type: "lead.search",
      payload: {
        query,
        maxResults: 40,
      } satisfies LeadSearchPayload,
      dedupeKey: `lead.search:${query.slice(0, 80)}`,
    },
    db
  );

  // Kick the pipeline once so work starts without a second tool call.
  const tick = await runTick();

  return {
    query,
    searchQueued: Boolean(job),
    work: {
      processed: tick.processed,
      succeeded: tick.succeeded,
      failed: tick.failed,
    },
    tip: "Call work again later to keep research/drafts moving.",
  };
}

async function toolSendToday(args: Record<string, unknown>) {
  const count = Math.max(
    0,
    Math.min(OUTREACH_MAX_SENDS_PER_DAY, Math.floor(Number(args.count)))
  );
  if (!Number.isFinite(Number(args.count))) {
    return { error: "count required" };
  }

  const note = args.note ? String(args.note) : undefined;
  const plan = await setNovaSendPlan({ dailyTarget: count, note });
  await setNovaSendArmed(true, note || `Sending ${count} today`);

  const db = requireNexusDb();
  const { data } = await db
    .from("nexus_drafts")
    .select("id")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(50);

  const available = data ?? [];
  const toQueue = Math.min(available.length, count);
  let queued = 0;
  for (const row of available.slice(0, toQueue)) {
    await enqueueOutreachSend(
      row.id,
      db,
      nextOutreachSendDelaySeconds() * (queued + 1)
    );
    queued += 1;
  }

  return {
    plan,
    queued,
    approvedAvailable: available.length,
    envSendEnabled: isNexusSendEnabled(),
    mailtrapConfigured: isMailtrapConfigured(),
    plainEnglish:
      queued === 0
        ? count === 0
          ? "Target set to 0 — nothing queued."
          : "No approved drafts ready. Run work / find_leads first."
        : !isMailtrapConfigured()
          ? `Queued ${queued}. They wait until Mailtrap is wired.`
          : !isNexusSendEnabled()
            ? `Queued ${queued}. Flip NEXUS_SEND_ENABLED=true to transmit.`
            : `Queued ${queued} sends, paced every 5–15 minutes.`,
  };
}

export async function runNovaTool(
  name: string,
  argsJson: string
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  // New simple names + old aliases so nothing breaks mid-flight.
  switch (name) {
    case "status":
    case "get_outreach_status":
    case "list_recent_drafts":
    case "list_companies":
      return JSON.stringify(await toolStatus());

    case "find_leads":
    case "start_search": {
      if (name === "start_search" && args.query && !args.city) {
        // legacy: query-only
      }
      return JSON.stringify(await toolFindLeads(args));
    }

    case "work":
    case "continue_pipeline": {
      const tick = await runTick();
      return JSON.stringify({
        processed: tick.processed,
        succeeded: tick.succeeded,
        failed: tick.failed,
        results: tick.results.slice(0, 8),
      });
    }

    case "send_today":
    case "queue_approved_sends": {
      if (name === "queue_approved_sends") {
        // legacy: count-only queue — still arm + plan for simplicity
        args.count = args.count ?? (await getNovaSendPlan()).dailyTarget;
      }
      return JSON.stringify(await toolSendToday(args));
    }

    case "pause":
    case "pause_outreach":
    case "set_send_armed": {
      if (name === "set_send_armed" && args.armed === true) {
        const plan = await setNovaSendArmed(true, String(args.reason ?? ""));
        return JSON.stringify({ ok: true, plan });
      }
      const reason = String(args.reason ?? "paused");
      const plan = await setNovaSendArmed(false, reason);
      await upsertNovaMemory({
        kind: "preference",
        key: "outreach.pause",
        content: `Paused: ${reason}`,
        metadata: { reason, at: new Date().toISOString() },
      });
      return JSON.stringify({ ok: true, plan, plainEnglish: "Sending paused." });
    }

    case "set_send_plan": {
      const dailyTarget = Number(args.dailyTarget ?? args.count);
      if (!Number.isFinite(dailyTarget)) {
        return JSON.stringify({ error: "dailyTarget required" });
      }
      const plan = await setNovaSendPlan({
        dailyTarget,
        note: args.note ? String(args.note) : undefined,
      });
      return JSON.stringify({ ok: true, plan });
    }

    case "remember": {
      const content = String(args.content ?? "").trim();
      if (!content) return JSON.stringify({ error: "content required" });
      const kind = (["note", "trial", "preference", "fact"] as const).includes(
        args.kind as "note"
      )
        ? (args.kind as "note" | "trial" | "preference" | "fact")
        : "note";
      await upsertNovaMemory({ kind, content });
      return JSON.stringify({ saved: true });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export function novaDbReady(): boolean {
  return Boolean(getNexusDb());
}
