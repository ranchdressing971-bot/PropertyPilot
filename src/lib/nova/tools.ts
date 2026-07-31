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
 * Tool implementations Nova (OpenAI) can call. Nexus executes; Nova decides.
 */

export const NOVA_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "get_outreach_status",
      description:
        "Live snapshot: companies, drafts, queue, Nova send plan, kill switch, Mailtrap.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_recent_drafts",
      description: "List recent outreach drafts with status and subject.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max drafts (default 10)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_companies",
      description: "List active Nexus companies (small HOA leads).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max companies (default 15)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "start_search",
      description:
        "Enqueue a Google Places lead search, e.g. HOA management in a city.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: 'e.g. "HOA management company in Austin TX"',
          },
          maxResults: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "continue_pipeline",
      description:
        "Run one Nexus tick: process queued jobs (research, draft, review, send).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_send_plan",
      description:
        "YOU decide today's send volume. Sets how many emails to aim for today (0–hard ceiling). Does not send by itself — call queue_approved_sends after.",
      parameters: {
        type: "object",
        properties: {
          dailyTarget: {
            type: "number",
            description: "How many emails to send today",
          },
          note: {
            type: "string",
            description: "Why this volume (strategy note)",
          },
        },
        required: ["dailyTarget"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_send_armed",
      description:
        "Arm or disarm sending. Disarmed = Nova pause (no transmits). Env NEXUS_SEND_ENABLED must also be true for real delivery.",
      parameters: {
        type: "object",
        properties: {
          armed: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["armed"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "queue_approved_sends",
      description:
        "Queue up to N approved drafts for paced delivery (5–15 min jitter). YOU choose count. Safe to call before Mailtrap is wired — jobs wait.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description:
              "How many approved drafts to queue now (default = remaining daily target)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pause_outreach",
      description: "Disarm sending and store the reason.",
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
      description:
        "Store a lasting note/trial/preference for future Nova sessions.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["note", "trial", "preference", "fact"],
          },
          content: { type: "string" },
          key: {
            type: "string",
            description: "Optional stable key to upsert (e.g. trial:short-subjects)",
          },
        },
        required: ["content"],
      },
    },
  },
];

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

  switch (name) {
    case "get_outreach_status": {
      const state = await loadNexusState(40);
      const plan = await getNovaSendPlan();
      const sent = state.drafts.filter((d) => d.status === "sent").length;
      const approved = state.drafts.filter((d) => d.status === "approved").length;
      const pending = state.pendingDraftCount;
      return JSON.stringify({
        schemaReady: state.schemaReady,
        phase2Ready: state.phase2Ready,
        companiesActive: state.companies.filter((c) => c.status === "active")
          .length,
        companyCount: state.companyCount,
        contacts: state.contactCount,
        draftsPendingReview: pending,
        draftsApproved: approved,
        draftsSentListed: sent,
        queuedJobs: state.queuedCount,
        novaPlan: plan,
        envSendEnabled: isNexusSendEnabled(),
        withinWindow: isWithinOutreachWindow(),
        mailtrapConfigured: isMailtrapConfigured(),
        mailtrapSandbox: isMailtrapSandbox(),
        hardDailyCeiling: OUTREACH_MAX_SENDS_PER_DAY,
        recentActions: state.actions.slice(0, 8).map((a) => ({
          action: a.action,
          at: a.created_at,
          meta: a.metadata,
        })),
      });
    }
    case "list_recent_drafts": {
      const state = await loadNexusState(30);
      const limit = Math.min(20, Number(args.limit) || 10);
      return JSON.stringify(
        state.drafts.slice(0, limit).map((d) => ({
          id: d.id,
          to: d.to_email,
          subject: d.subject,
          status: d.status,
          company: d.company_name,
          confidence: d.confidence,
        }))
      );
    }
    case "list_companies": {
      const state = await loadNexusState(40);
      const limit = Math.min(30, Number(args.limit) || 15);
      return JSON.stringify(
        state.companies
          .filter((c) => c.status === "active")
          .slice(0, limit)
          .map((c) => ({
            id: c.id,
            name: c.name,
            city: c.city,
            state: c.state,
            website: c.website,
            stage: c.stage,
            research: c.research_status,
            reviews: c.metadata?.userRatingCount ?? null,
          }))
      );
    }
    case "start_search": {
      const query = String(args.query ?? "").trim();
      if (!query) return JSON.stringify({ error: "query required" });
      const db = requireNexusDb();
      const job = await enqueueJob(
        {
          type: "lead.search",
          payload: {
            query,
            maxResults: Number(args.maxResults) || 40,
          } satisfies LeadSearchPayload,
          dedupeKey: `lead.search:${query.slice(0, 80)}`,
        },
        db
      );
      return JSON.stringify({
        queued: Boolean(job),
        query,
        tip: "Call continue_pipeline to process the search.",
      });
    }
    case "continue_pipeline": {
      const tick = await runTick();
      return JSON.stringify({
        processed: tick.processed,
        succeeded: tick.succeeded,
        failed: tick.failed,
        results: tick.results.slice(0, 10),
      });
    }
    case "set_send_plan": {
      const dailyTarget = Number(args.dailyTarget);
      if (!Number.isFinite(dailyTarget)) {
        return JSON.stringify({ error: "dailyTarget required" });
      }
      const plan = await setNovaSendPlan({
        dailyTarget,
        note: args.note ? String(args.note) : undefined,
      });
      return JSON.stringify({ ok: true, plan });
    }
    case "set_send_armed": {
      const armed = Boolean(args.armed);
      const plan = await setNovaSendArmed(
        armed,
        args.reason ? String(args.reason) : undefined
      );
      return JSON.stringify({
        ok: true,
        plan,
        envSendEnabled: isNexusSendEnabled(),
        mailtrapConfigured: isMailtrapConfigured(),
        tip: !isNexusSendEnabled()
          ? "Armed in Nova, but env NEXUS_SEND_ENABLED is still false — no real sends until Isaac flips it."
          : !isMailtrapConfigured()
            ? "Armed, but Mailtrap is not wired yet — queued jobs will wait."
            : "Ready to transmit when you queue sends.",
      });
    }
    case "queue_approved_sends": {
      const plan = await getNovaSendPlan();
      const db = requireNexusDb();
      const { data } = await db
        .from("nexus_drafts")
        .select("id")
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(50);

      const available = data ?? [];
      const requested =
        args.count != null && Number.isFinite(Number(args.count))
          ? Math.floor(Number(args.count))
          : plan.dailyTarget;
      const count = Math.max(
        0,
        Math.min(available.length, requested, OUTREACH_MAX_SENDS_PER_DAY)
      );

      let n = 0;
      for (const row of available.slice(0, count)) {
        await enqueueOutreachSend(
          row.id,
          db,
          nextOutreachSendDelaySeconds() * (n + 1)
        );
        n += 1;
      }

      return JSON.stringify({
        queued: n,
        approvedAvailable: available.length,
        dailyTarget: plan.dailyTarget,
        armed: plan.armed,
        envSendEnabled: isNexusSendEnabled(),
        mailtrapConfigured: isMailtrapConfigured(),
        note:
          n === 0
            ? "Nothing queued — need approved drafts, or count was 0."
            : !isMailtrapConfigured()
              ? "Queued. Delivery waits until Mailtrap is configured."
              : !plan.armed
                ? "Queued, but Nova is disarmed — arm before they transmit."
                : !isNexusSendEnabled()
                  ? "Queued, but NEXUS_SEND_ENABLED is false."
                  : "Queued with 5–15 min pacing.",
      });
    }
    case "pause_outreach": {
      const reason = String(args.reason ?? "operator asked to pause");
      const plan = await setNovaSendArmed(false, reason);
      await upsertNovaMemory({
        kind: "preference",
        key: "outreach.pause",
        content: `Paused: ${reason}`,
        metadata: { reason, at: new Date().toISOString() },
      });
      return JSON.stringify({
        remembered: true,
        plan,
        note: "Nova disarmed. Optional hard stop: NEXUS_SEND_ENABLED=false on Vercel.",
      });
    }
    case "remember": {
      const content = String(args.content ?? "").trim();
      if (!content) return JSON.stringify({ error: "content required" });
      const kind = (["note", "trial", "preference", "fact"] as const).includes(
        args.kind as "note"
      )
        ? (args.kind as "note" | "trial" | "preference" | "fact")
        : "note";
      await upsertNovaMemory({
        kind,
        content,
        key: args.key ? String(args.key) : undefined,
      });
      return JSON.stringify({ saved: true, kind });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export function novaDbReady(): boolean {
  return Boolean(getNexusDb());
}
