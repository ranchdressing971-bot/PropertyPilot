import { enqueueJob, getNexusDb, requireNexusDb } from "@/lib/nexus/jobs";
import { loadNexusState } from "@/lib/nexus/state";
import { enqueueOutreachSend } from "@/lib/nexus/hands/send";
import { isMailtrapConfigured, isMailtrapSandbox } from "@/lib/nexus/mailtrap";
import {
  clampDailySendTarget,
  isNexusSendEnabled,
  isWithinOutreachWindow,
  nextOutreachSendDelaySeconds,
  OUTREACH_MIN_SENDS_PER_DAY,
  outreachMaxSendsPerDay,
} from "@/lib/nexus/outreach-policy";
import { runTick } from "@/lib/nexus/runner";
import type { LeadSearchPayload } from "@/lib/nexus/types";
import { loadConversionReport, loadConversionSummary } from "./conversions";
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
 *   status | find_leads | work | send_today | learn | pause | remember
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
        "ONE call for today's send plan: arms Nova and queues that many approved drafts (paced). YOU usually pick the count — keep it at least 20, up to 50. Omit count to use your current plan / default 20+.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: `Emails today (${OUTREACH_MIN_SENDS_PER_DAY}–${outreachMaxSendsPerDay()}, or 0 to pause)`,
          },
          note: { type: "string", description: "Optional why" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "learn",
      description:
        "Deep learning dossier: who signed up or subscribed after your emails, timing lag (sent→signup→subscribe), WHY hints per convert, converts vs non-converts (themes/subjects that convert and subscribe, length, hour/weekday ET, city/state, review bands), soft name matches, funnel, rejections, trials, recent subscribers, and auto insights. Call this often; then remember winning hypotheses.",
      parameters: {
        type: "object",
        properties: {
          sinceDays: {
            type: "number",
            description: "Lookback window in days (default 90, max 365)",
          },
          limit: {
            type: "number",
            description: "Max matched convert rows (default 15)",
          },
        },
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
  const conversions = await loadConversionSummary(90);
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
      conversionsMatched: conversions.matchedCount,
      conversionRate: conversions.conversionRate,
      subscribedCount: conversions.subscribedCount,
      subscriptionRate: conversions.subscriptionRate,
      sentInWindow: conversions.sentCount,
      recentSignups: conversions.recentSignupCount,
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
    tip: "Call learn for converts, subscribers, why-hints, and what differs from non-converts.",
  };
}

async function toolLearn(args: Record<string, unknown>) {
  const sinceDays =
    args.sinceDays != null && Number.isFinite(Number(args.sinceDays))
      ? Number(args.sinceDays)
      : 90;
  const limit =
    args.limit != null && Number.isFinite(Number(args.limit))
      ? Number(args.limit)
      : 15;

  const report = await loadConversionReport({
    sinceDays,
    limit,
    syncWins: true,
  });

  // Persist compact + insight memory so future sessions keep the lesson.
  const bits = [
    `${report.matchedCount}/${report.sentCount} signup converts (${report.conversionRate}%) last ${report.sinceDays}d`,
  ];
  if (report.subscribedCount > 0) {
    bits.push(
      `${report.subscribedCount} subscribed (${report.subscriptionRate}% of sends)`
    );
  }
  const topSubject = report.bySubject.find((s) => s.converted > 0);
  const topTheme = report.byTheme.find((t) => t.converted > 0 && t.key !== "no_theme");
  const topSubTheme = report.byThemeSubscribed.find(
    (t) => t.converted > 0 && t.key !== "no_theme"
  );
  const topCity = report.byCity.find((c) => c.converted > 0);
  if (topSubject) {
    bits.push(
      `subject: "${topSubject.key.slice(0, 70)}" (${topSubject.converted}/${topSubject.sent})`
    );
  }
  if (topTheme) {
    bits.push(
      `theme: ${topTheme.key} (${topTheme.converted}/${topTheme.sent}, ${topTheme.rate}%)`
    );
  }
  if (topSubTheme) {
    bits.push(
      `sub theme: ${topSubTheme.key} (${topSubTheme.converted}/${topSubTheme.sent})`
    );
  }
  if (topCity) {
    bits.push(`city: ${topCity.key} (${topCity.converted}/${topCity.sent})`);
  }
  if (report.avgDaysToSignup != null) {
    bits.push(`avg days→signup: ${report.avgDaysToSignup}`);
  }
  if (report.avgDaysToSubscribe != null) {
    bits.push(`avg days→subscribe: ${report.avgDaysToSubscribe}`);
  }
  if (report.insights[0]) bits.push(report.insights[0]);

  await upsertNovaMemory({
    kind: "trial",
    key: "outreach.learning",
    content: bits.join(" · "),
    metadata: {
      matchedCount: report.matchedCount,
      sentCount: report.sentCount,
      conversionRate: report.conversionRate,
      subscribedCount: report.subscribedCount,
      subscriptionRate: report.subscriptionRate,
      topThemesConverted: report.winnersVsLosers.topThemesConverted,
      topThemesSubscribed: report.byThemeSubscribed
        .filter((t) => t.converted > 0)
        .slice(0, 5)
        .map((t) => t.key),
      bestHoursEt: report.winnersVsLosers.bestHoursEt,
      avgDaysToSubscribe: report.avgDaysToSubscribe,
      insights: report.insights.slice(0, 6),
      at: new Date().toISOString(),
    },
  });

  return {
    insights: report.insights,
    summary: {
      sentCount: report.sentCount,
      matchedCount: report.matchedCount,
      conversionRate: report.conversionRate,
      paidOrActiveConverts: report.paidOrActiveConverts,
      subscribedCount: report.subscribedCount,
      subscriptionRate: report.subscriptionRate,
      avgDaysToSignup: report.avgDaysToSignup,
      medianDaysToSignup: report.medianDaysToSignup,
      avgDaysToSubscribe: report.avgDaysToSubscribe,
      medianDaysToSubscribe: report.medianDaysToSubscribe,
    },
    subscriptionFunnel: report.subscriptionFunnel,
    winnersVsLosers: report.winnersVsLosers,
    byTheme: report.byTheme,
    byThemeSubscribed: report.byThemeSubscribed,
    bySubjectSubscribed: report.bySubjectSubscribed,
    byCity: report.byCity,
    byState: report.byState,
    byHourEt: report.byHourEt,
    byWeekday: report.byWeekday,
    byBodyLength: report.byBodyLength,
    byReviewBucket: report.byReviewBucket,
    byConfidence: report.byConfidence,
    bySubject: report.bySubject,
    matches: report.matches,
    nonConvertedSample: report.nonConvertedSample,
    funnel: report.funnel,
    rejections: report.rejections,
    softNameMatches: report.softNameMatches,
    recentSignups: report.recentSignups,
    recentSubscribers: report.recentSubscribers,
    recentTrials: report.recentTrials,
    recentActions: report.recentActions,
    appContext: report.appContext,
    plainEnglish:
      report.sentCount === 0
        ? "No sent outreach in this window yet — nothing to learn from."
        : report.matchedCount === 0
          ? `Sent ${report.sentCount}. No hard email→signup matches yet. Soft name matches: ${report.softNameMatches.length}. Subscribers after outreach: ${report.subscribedCount}. Read insights + nonConvertedSample, then experiment and remember.`
          : `${report.matchedCount} signup convert(s) (${report.conversionRate}%), ${report.subscribedCount} subscribed (${report.subscriptionRate}%). Read matches[].whyHints, daysToSubscribe, and byThemeSubscribed — then remember the hypothesis.`,
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
  const current = await getNovaSendPlan();
  const raw =
    args.count != null && Number.isFinite(Number(args.count))
      ? Number(args.count)
      : current.dailyTarget || OUTREACH_MIN_SENDS_PER_DAY;
  const count = clampDailySendTarget(raw);

  const note = args.note ? String(args.note) : undefined;
  const plan = await setNovaSendPlan({ dailyTarget: count, note });
  if (count === 0) {
    await setNovaSendArmed(false, note || "Paused at 0");
    return {
      plan,
      queued: 0,
      plainEnglish: "Paused — 0 sends today.",
    };
  }
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

    case "learn":
    case "conversions":
    case "check_signups":
    case "who_signed_up":
      return JSON.stringify(await toolLearn(args));

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
      const dailyTarget = clampDailySendTarget(
        Number(args.dailyTarget ?? args.count ?? OUTREACH_MIN_SENDS_PER_DAY)
      );
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
