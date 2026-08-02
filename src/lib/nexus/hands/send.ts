import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob, logAction } from "../jobs";
import {
  isMailtrapConfigured,
  isMailtrapSandbox,
  sendViaMailtrap,
} from "../mailtrap";
import { getNovaSendPlan } from "@/lib/nova/send-plan";
import {
  isNexusSendEnabled,
  isWithinOutreachWindow,
  nextOutreachSendDelaySeconds,
  outreachMaxSendsPerDay,
  secondsUntilOutreachWindow,
} from "../outreach-policy";
import type { HandResult, OutreachSendPayload } from "../types";

/**
 * Delivery Hand — transmits an approved draft via Mailtrap.
 *
 * Nova chooses how many to queue. Hard gates still apply: env kill switch,
 * Nova pause flag, Nova daily target, suppressions, and (outside sandbox)
 * the 10–3 window.
 */

/** Consumer / free mail hosts — never domain-suppress these after a send. */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "ymail.com",
]);

async function findSuppression(
  email: string,
  db: SupabaseClient
): Promise<string | null> {
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1] ?? "";
  const { data, error } = await db
    .from("nexus_suppressions")
    .select("email, domain, reason")
    .or(`email.ilike.${lower},domain.ilike.${domain}`)
    .limit(1);

  if (error) {
    throw new Error(`Suppression check failed: ${error.message}`);
  }
  const hit = data?.[0] as { reason?: string } | undefined;
  return hit?.reason ?? null;
}

/**
 * After a real send, suppress the company mailbox domain so we do not
 * double-email the same management firm via another contact. Skips public
 * webmail hosts.
 */
async function suppressCompanyDomainAfterSend(
  email: string,
  db: SupabaseClient
): Promise<string | null> {
  const domain = email.toLowerCase().split("@")[1]?.trim() ?? "";
  if (!domain || PUBLIC_MAIL_DOMAINS.has(domain)) return null;

  const { data: existing } = await db
    .from("nexus_suppressions")
    .select("id")
    .ilike("domain", domain)
    .maybeSingle();
  if (existing) return domain;

  const { error } = await db.from("nexus_suppressions").insert({
    domain,
    reason: "already_contacted",
    notes: "Auto domain suppress after outbound send — no double-email company",
  });
  if (error && error.code !== "23505") {
    console.error("[nexus] domain suppress after send failed:", error.message);
    return null;
  }
  return domain;
}

export async function countSentToday(db: SupabaseClient): Promise<number> {
  // Rolling ~business-day window — good enough for the hard cap.
  const since = new Date(Date.now() - 20 * 3600_000).toISOString();
  const { count, error } = await db
    .from("nexus_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);

  if (error || count == null) {
    const { count: actionCount } = await db
      .from("nexus_actions")
      .select("id", { count: "exact", head: true })
      .eq("action", "outreach.email_sent")
      .gte("created_at", since);
    return actionCount ?? 0;
  }
  return count;
}

/** Outstanding outreach.send jobs (queued or in-flight). */
export async function countQueuedSends(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("nexus_jobs")
    .select("id", { count: "exact", head: true })
    .eq("type", "outreach.send")
    .in("status", ["queued", "running"]);

  if (error || count == null) return 0;
  return count;
}

/** Queue send for one approved draft with pacing delay. */
export async function enqueueOutreachSend(
  draftId: string,
  db: SupabaseClient,
  delaySeconds?: number
): Promise<void> {
  await enqueueJob(
    {
      type: "outreach.send",
      payload: { draftId } satisfies OutreachSendPayload,
      dedupeKey: `outreach.send:${draftId}`,
      delaySeconds:
        delaySeconds ?? nextOutreachSendDelaySeconds(),
    },
    db
  );
}

export async function runOutreachSend(
  payload: OutreachSendPayload,
  db: SupabaseClient
): Promise<HandResult> {
  const draftId = payload.draftId;
  if (!draftId) throw new Error("outreach.send requires a draftId");

  if (!isNexusSendEnabled()) {
    return {
      summary: "skipped — NEXUS_SEND_ENABLED is off (env kill switch)",
      metadata: { draftId, reason: "kill_switch" },
    };
  }

  const plan = await getNovaSendPlan();
  if (!plan.armed) {
    return {
      summary: "skipped — Nova is paused",
      metadata: { draftId, reason: "nova_paused" },
    };
  }

  if (!isMailtrapConfigured()) {
    // Don't fail the job hard — Isaac may wire Mailtrap later. Requeue gently.
    await enqueueJob(
      {
        type: "outreach.send",
        payload: { draftId } satisfies OutreachSendPayload,
        dedupeKey: `outreach.send:${draftId}:mailtrap`,
        delaySeconds: 3600,
      },
      db
    );
    return {
      summary: "waiting — MAILTRAP_API_TOKEN not configured yet",
      metadata: { draftId, reason: "mailtrap_missing" },
    };
  }

  const sandbox = isMailtrapSandbox();
  // Sandbox testing may run anytime; live send respects 10–3 ET.
  if (!sandbox && !isWithinOutreachWindow()) {
    const wait = secondsUntilOutreachWindow();
    await enqueueJob(
      {
        type: "outreach.send",
        payload: { draftId } satisfies OutreachSendPayload,
        dedupeKey: `outreach.send:${draftId}:window`,
        delaySeconds: wait,
      },
      db
    );
    return {
      summary: `outside send window — requeued in ${Math.round(wait / 60)}m`,
      metadata: { draftId, reason: "outside_window", waitSeconds: wait },
    };
  }

  const today = await countSentToday(db);
  const dayCap = Math.min(outreachMaxSendsPerDay(), plan.dailyTarget);
  if (today >= dayCap) {
    const wait = secondsUntilOutreachWindow(/* nextDay */ true);
    await enqueueJob(
      {
        type: "outreach.send",
        payload: { draftId } satisfies OutreachSendPayload,
        dedupeKey: `outreach.send:${draftId}:cap`,
        delaySeconds: Math.max(wait, 3600),
      },
      db
    );
    return {
      summary: `Nova daily target ${dayCap} hit (${today} sent) — requeued`,
      metadata: { draftId, reason: "daily_cap", today, dayCap },
    };
  }

  const { data: draft, error } = await db
    .from("nexus_drafts")
    .select(
      "id, company_id, contact_id, to_email, subject, body, status, metadata"
    )
    .eq("id", draftId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load draft: ${error.message}`);
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  if (draft.status === "sent") {
    return { summary: "already sent", metadata: { draftId } };
  }
  if (draft.status !== "approved") {
    return {
      summary: `skipped — draft is ${draft.status}`,
      metadata: { draftId, status: draft.status },
    };
  }

  const suppressed = await findSuppression(draft.to_email, db);
  if (suppressed) {
    await db
      .from("nexus_drafts")
      .update({
        status: "rejected",
        rejection_reason: `suppressed: ${suppressed}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);
    return {
      summary: `suppressed (${suppressed})`,
      metadata: { draftId, reason: suppressed },
    };
  }

  const result = await sendViaMailtrap({
    to: draft.to_email,
    subject: draft.subject,
    text: draft.body,
  });

  const now = new Date().toISOString();
  await db
    .from("nexus_drafts")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
      metadata: {
        ...((draft.metadata as Record<string, unknown> | null) ?? {}),
        mailtrap: {
          messageIds: result.messageIds,
          sandbox: result.sandbox,
          sentAt: now,
        },
      },
    })
    .eq("id", draftId);

  await db
    .from("nexus_companies")
    .update({ stage: "contacted", updated_at: now })
    .eq("id", draft.company_id);

  const suppressedDomain = await suppressCompanyDomainAfterSend(
    draft.to_email,
    db
  );

  await logAction(
    {
      action: "outreach.email_sent",
      entityType: "draft",
      entityId: draftId,
      metadata: {
        to: draft.to_email,
        subject: draft.subject,
        sandbox: result.sandbox,
        messageIds: result.messageIds,
        domainSuppressed: suppressedDomain,
      },
    },
    db
  );

  return {
    summary: `sent to ${draft.to_email}${result.sandbox ? " (sandbox)" : ""}${
      suppressedDomain ? `; domain ${suppressedDomain} suppressed` : ""
    }`,
    metadata: {
      draftId,
      to: draft.to_email,
      sandbox: result.sandbox,
      messageIds: result.messageIds,
      domainSuppressed: suppressedDomain,
    },
  };
}
