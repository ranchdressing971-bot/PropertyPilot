import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob, logAction } from "../jobs";
import {
  isMailtrapConfigured,
  isMailtrapSandbox,
  sendViaMailtrap,
} from "../mailtrap";
import {
  isNexusSendEnabled,
  isWithinOutreachWindow,
  nextOutreachSendDelaySeconds,
  OUTREACH_MAX_SENDS_PER_DAY,
  secondsUntilOutreachWindow,
} from "../outreach-policy";
import type { HandResult, OutreachSendPayload } from "../types";

/**
 * Delivery Hand — transmits an approved draft via Mailtrap.
 *
 * Kill switch, daily cap, suppressions, and (outside sandbox) the 10–3 window
 * all gate the send. Failures requeue with backoff via the job runner.
 */

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

async function sentTodayCount(db: SupabaseClient): Promise<number> {
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
      summary: "skipped — NEXUS_SEND_ENABLED is off",
      metadata: { draftId, reason: "kill_switch" },
    };
  }

  if (!isMailtrapConfigured()) {
    throw new Error("MAILTRAP_API_TOKEN is not configured");
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

  const today = await sentTodayCount(db);
  if (today >= OUTREACH_MAX_SENDS_PER_DAY) {
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
      summary: `daily cap ${OUTREACH_MAX_SENDS_PER_DAY} hit — requeued`,
      metadata: { draftId, reason: "daily_cap", today },
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
      },
    },
    db
  );

  return {
    summary: `sent to ${draft.to_email}${result.sandbox ? " (sandbox)" : ""}`,
    metadata: {
      draftId,
      to: draft.to_email,
      sandbox: result.sandbox,
      messageIds: result.messageIds,
    },
  };
}
