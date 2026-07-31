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

/**
 * Tool implementations Nova (OpenAI) can call. Nexus executes; Nova decides.
 */

export const NOVA_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "get_outreach_status",
      description:
        "Live snapshot: companies, drafts, queue, sends, kill switch, Mailtrap mode.",
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
      name: "queue_approved_sends",
      description:
        "Enqueue Mailtrap send jobs for all approved drafts (paced).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pause_outreach",
      description:
        "Remember that Isaac wants sending paused. Does not flip env kill switch — reminds operator to set NEXUS_SEND_ENABLED=false.",
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
        sendEnabled: isNexusSendEnabled(),
        withinWindow: isWithinOutreachWindow(),
        mailtrapConfigured: isMailtrapConfigured(),
        mailtrapSandbox: isMailtrapSandbox(),
        dailyCap: OUTREACH_MAX_SENDS_PER_DAY,
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
    case "queue_approved_sends": {
      if (!isNexusSendEnabled()) {
        return JSON.stringify({
          error: "NEXUS_SEND_ENABLED is not true — flip it in env to send.",
        });
      }
      const db = requireNexusDb();
      const { data } = await db
        .from("nexus_drafts")
        .select("id")
        .eq("status", "approved")
        .limit(30);
      let n = 0;
      for (const row of data ?? []) {
        await enqueueOutreachSend(
          row.id,
          db,
          nextOutreachSendDelaySeconds() * (n + 1)
        );
        n += 1;
      }
      return JSON.stringify({ queued: n });
    }
    case "pause_outreach": {
      const reason = String(args.reason ?? "operator asked to pause");
      await upsertNovaMemory({
        kind: "preference",
        key: "outreach.pause",
        content: `Paused: ${reason}. Operator should set NEXUS_SEND_ENABLED=false on Vercel.`,
        metadata: { reason, at: new Date().toISOString() },
      });
      return JSON.stringify({
        remembered: true,
        note: "Kill switch is an env var — set NEXUS_SEND_ENABLED=false and redeploy to hard-stop sends.",
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
