import { enqueueJob, getNexusDb, requireNexusDb } from "@/lib/nexus/jobs";
import { loadNexusState } from "@/lib/nexus/state";
import { enqueueOutreachSend } from "@/lib/nexus/hands/send";
import {
  clampDailySendTarget,
  isNexusSendEnabled,
  isWithinOutreachWindow,
  OUTREACH_MIN_SENDS_PER_DAY,
  outreachMaxSendsPerDay,
} from "@/lib/nexus/outreach-policy";
import { runTick } from "@/lib/nexus/runner";
import type { LeadSearchPayload } from "@/lib/nexus/types";
import { isResendConfigured } from "@/lib/resend";
import {
  logAbuseScanSummary,
  scanCommunityUsageAbuse,
} from "@/lib/abuse/community-usage-scan";
import { loadBusinessBrief } from "./business";
import { loadConversionReport, loadConversionSummary } from "./conversions";
import {
  computeNovaDailyTarget,
  loadApprovedDraftsForSend,
  loadLearnHints,
  outreachSendDelayWithBias,
} from "./daily-plan";
import { persistNovaLearning } from "./learning-persist";
import { upsertNovaMemory } from "./memory";
import {
  getNovaSendPlan,
  setNovaSendArmed,
  setNovaSendPlan,
} from "./send-plan";

/**
 * Small, obvious tools. Nova uses them to decide — and to back up pushback with data.
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
        "Pipeline + delivery (prep_only — waiting on domain/Resend) + business snapshot (MRR/clients) + API cost notes + blockers. Call before claiming you can email HOAs or before burning Places/OpenAI.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business",
      description:
        "Full RideBy fleet intel: revenue (MRR/ARR/pipeline/multi-community), clients, activation, trial→paid, teams, product usage, abuse bot (under-billed communities), watchlists. Call for business/MRR/client/churn/activation — never invent numbers.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "abuse",
      description:
        "Run the community abuse bot: finds accounts billed for fewer communities than roster/inspection evidence (e.g. paid for 1, evidence of many neighborhoods/ZIPs). Review-only — never blocks. Use when Isaac asks about sus/abuse/under-billing.",
      parameters: {
        type: "object",
        properties: {
          persist: {
            type: "boolean",
            description: "If true, write suspects to audit_log for history",
          },
          limit: {
            type: "number",
            description: "Max suspects to return (default 25)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_leads",
      description:
        "Find HOA management companies (Google Places — costs quota). Pass a city like Austin. Prefer one intentional city; skip if approved drafts are already stocked.",
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
        "Process research/draft/review/send jobs (OpenAI $). Don't thrash if the queue is empty or you're in prep_only — one solid batch beats spam loops.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_today",
      description:
        "Optional override: set today's prep/queue volume or resume after pause. Does NOT transmit live — Mailtrap unverified; go-live is Resend after domain. Refuse weak batches.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: `Override emails today (${OUTREACH_MIN_SENDS_PER_DAY}–${outreachMaxSendsPerDay()}, or 0 to pause)`,
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
        "Evidence dossier: converts vs non-converts, subscribers, timing lag, why-hints, theme/subject/city/hour slices, funnel, rejections, trials, auto insights. Call before arguing with Isaac or changing strategy — use numbers to recommend or refuse. Then remember kind=trial with a testable hypothesis.",
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
      description:
        "Stop sending — use when quality is off, data is thin, or Isaac's push is premature. Stays paused until Isaac asks you to resume (send_today or explicit resume). Give Isaac the reason.",
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
        "Save a note/trial/preference/fact — especially after learn (hypotheses, what worked, what to stop doing).",
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
  const business = await loadBusinessBrief();
  const approved = state.drafts.filter((d) => d.status === "approved");
  const sent = state.drafts.filter((d) => d.status === "sent");
  const active = state.companies.filter((c) => c.status === "active");

  const sendOn = isNexusSendEnabled();
  const resend = isResendConfigured();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXUS_APP_URL?.trim() ||
    null;
  const looksCustomDomain = Boolean(
    appUrl && !/vercel\.app/i.test(appUrl) && /^https?:\/\//i.test(appUrl)
  );
  // Mailtrap is not verified / not the plan. Live path = Resend after domain (not wired yet).
  const canTransmitLive = false;

  const blockers: string[] = [];
  if (!plan.armed) blockers.push("Nova paused (ask to resume or call send_today)");
  blockers.push(
    "Waiting on custom domain — then Resend sending domain (Mailtrap is NOT verified / not go-live)"
  );
  if (!resend) {
    blockers.push("Resend API key not set yet (will be used after domain)");
  }
  if (!sendOn) {
    blockers.push(
      "NEXUS_SEND_ENABLED is false — flip after domain + Resend are live"
    );
  }
  if (!looksCustomDomain) {
    blockers.push(
      "App URL still looks like default/vercel — need custom domain for CTA/from-domain"
    );
  }
  if (!isWithinOutreachWindow()) {
    blockers.push(
      "outside configured ET send window (current operational rail; matters when live)"
    );
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
    business: {
      mrr: business.mrr,
      arr: business.arr,
      pipelineMrr: business.pipelineMrr,
      payingClients: business.payingClients,
      trialingClients: business.trialingClients,
      pastDueClients: business.pastDueClients,
      canceledClients: business.canceledClients,
      productCompanies: business.productCompanies,
      inspectionsTotal: business.inspectionsTotal,
      activation: business.activation,
      teams: business.teams,
      trials: {
        claimed: business.trials.claimed,
        converted: business.trials.claimedConverted,
        stillUnpaid: business.trials.claimedStillUnpaid,
      },
      trust: {
        abuseFlagged: business.trust.abuseFlagged,
        abuseHigh: business.trust.abuseHigh,
        abuseMedium: business.trust.abuseMedium,
        abusePlainEnglish: business.trust.abusePlainEnglish,
      },
      watchlistCounts: {
        pastDue: business.watchlists.pastDue.length,
        deadPaid: business.watchlists.deadPaid.length,
        trialBurned: business.watchlists.trialBurnedUnpaid.length,
        underBilled: business.watchlists.underBilledCommunities.length,
      },
      plainEnglish: business.plainEnglish,
      tip: "Call business or abuse for under-billed community suspects.",
    },
    delivery: {
      canTransmitLive,
      mode: "prep_only",
      plannedProvider: "resend",
      mailtrapVerified: false,
      mailtrapIsGoLivePath: false,
      appUrl,
      customDomainLikely: looksCustomDomain,
      nexusSendEnabled: sendOn,
      resendConfigured: resend,
      waitingOnDomain: true,
      plainEnglish:
        "Cannot send to real HOA inboxes yet. Mailtrap not verified. Go live with Resend after the custom domain.",
    },
    apiCosts: {
      openai:
        "Chat, drafts, AI review, learn — real $ per call. Avoid thrashing work/learn/find_leads.",
      googlePlaces:
        "find_leads burns Places quota (~1k free Enterprise/mo class, then paid). One city with intent.",
      resend: "Transmit cost + deliverability — only when live send is on (after domain).",
      tip: "If approved drafts are already stocked, skip find_leads to save Places + draft tokens.",
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
    tip: "Be honest about prep_only. Mention OpenAI/Places cost. Use business for MRR/clients. Treat todayTarget and send-window blockers as current settings/rails, not best-practice gospel.",
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

  await persistNovaLearning(report);

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
        ? "Nothing sent in this window — I can't argue from data yet. Run a small batch or widen the window."
        : report.matchedCount === 0
          ? `Sent ${report.sentCount}, zero hard converts. ${report.softNameMatches.length} soft name matches; ${report.subscribedCount} subscribed. Read insights + nonConvertedSample before scaling — I'd experiment, not blast.`
          : `${report.matchedCount} signup convert(s) (${report.conversionRate}%), ${report.subscribedCount} subscribed (${report.subscriptionRate}%). matches[].whyHints and byThemeSubscribed are your leverage — remember a hypothesis before the next batch.`,
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
  const hints = await loadLearnHints();
  const db = requireNexusDb();

  const { count: approvedCount } = await db
    .from("nexus_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  let count: number;
  let note = args.note ? String(args.note) : undefined;

  if (args.count != null && Number.isFinite(Number(args.count))) {
    count = clampDailySendTarget(Number(args.count));
  } else {
    const { countSentToday } = await import("@/lib/nexus/hands/send");
    const sentToday = await countSentToday(db);
    const computed = computeNovaDailyTarget({
      approvedCount: approvedCount ?? 0,
      sentToday,
      hints,
    });
    count = computed.target || current.dailyTarget || OUTREACH_MIN_SENDS_PER_DAY;
    note = note ?? computed.note;
  }

  const plan = await setNovaSendPlan({ dailyTarget: count, note });
  if (count === 0) {
    await setNovaSendArmed(false, note || "Paused at 0");
    return {
      plan,
      queued: 0,
      plainEnglish: "Paused — 0 sends today.",
    };
  }
  await setNovaSendArmed(true, note || `Override: ${count} today`);

  const approved = await loadApprovedDraftsForSend(
    db,
    Math.min(count, 50),
    hints
  );
  const toQueue = Math.min(approved.length, count);
  let queued = 0;
  for (const row of approved.slice(0, toQueue)) {
    await enqueueOutreachSend(
      row.id,
      db,
      outreachSendDelayWithBias(hints.bestHoursEt) * (queued + 1)
    );
    queued += 1;
  }

  return {
    plan,
    queued,
    approvedAvailable: approved.length,
    envSendEnabled: isNexusSendEnabled(),
    plannedProvider: "resend",
    mailtrapVerified: false,
    plainEnglish:
      queued === 0
        ? count === 0
          ? "Target set to 0 — nothing queued."
          : "No approved drafts ready. Run work / find_leads first."
        : `Queued ${queued}. Prep only — Mailtrap not verified; real inboxes wait on domain + Resend + NEXUS_SEND_ENABLED.`,
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

    case "business":
    case "mrr":
    case "clients":
    case "fleet":
      return JSON.stringify(await loadBusinessBrief());

    case "abuse":
    case "sus":
    case "under_billed": {
      const limit =
        args.limit != null && Number.isFinite(Number(args.limit))
          ? Number(args.limit)
          : 25;
      const report = await scanCommunityUsageAbuse({ limit });
      if (args.persist === true) {
        await logAbuseScanSummary(report);
        await upsertNovaMemory({
          kind: "fact",
          key: "abuse.community_usage",
          content: report.plainEnglish,
          metadata: {
            flaggedCount: report.flaggedCount,
            highCount: report.highCount,
            at: new Date().toISOString(),
          },
        });
      }
      return JSON.stringify(report);
    }

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
