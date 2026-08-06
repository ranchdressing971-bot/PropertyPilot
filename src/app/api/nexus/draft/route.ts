import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  enqueueJob,
  logAction,
  NexusNotConfiguredError,
  NexusSchemaMissingError,
  requireNexusDb,
} from "@/lib/nexus/jobs";
import { isOutreachConfigured } from "@/lib/nexus/hands/outreach";
import type { OutreachDraftPayload } from "@/lib/nexus/types";

export const dynamic = "force-dynamic";

/** Each draft costs a model call, so keep the blast radius of one click small. */
const MAX_BATCH = 25;

/**
 * Queue Outreach Hand drafts. Drafting only — the hand writes to the review
 * queue and has no send path.
 */
export async function POST(request: Request) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isOutreachConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { companyId?: string; contactId?: string; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const db = requireNexusDb();

    let targets: Array<{ companyId: string; contactId?: string }>;

    if (body.companyId) {
      targets = [{ companyId: body.companyId, contactId: body.contactId }];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 5, 1), MAX_BATCH);

      // Companies that have at least one contact and no draft yet. Done as two
      // queries rather than a join because PostgREST cannot express "not exists"
      // across tables cleanly.
      const { data: withContacts, error: contactsError } = await db
        .from("nexus_contacts")
        .select("company_id")
        .order("confidence", { ascending: false })
        .limit(500);
      if (contactsError) throw new Error(contactsError.message);

      const { data: drafted, error: draftedError } = await db
        .from("nexus_drafts")
        .select("company_id")
        .in("status", ["pending_approval", "approved", "sent"]);
      if (draftedError) throw new Error(draftedError.message);

      const alreadyDrafted = new Set(
        (drafted ?? []).map((row) => row.company_id as string)
      );
      const seen = new Set<string>();

      targets = [];
      for (const row of withContacts ?? []) {
        const companyId = row.company_id as string;
        if (seen.has(companyId) || alreadyDrafted.has(companyId)) continue;
        seen.add(companyId);
        targets.push({ companyId });
        if (targets.length >= limit) break;
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        queued: 0,
        message: "No companies with contacts are waiting for a draft",
      });
    }

    let queued = 0;
    for (const target of targets) {
      const job = await enqueueJob(
        {
          type: "outreach.draft",
          payload: {
            companyId: target.companyId,
            ...(target.contactId ? { contactId: target.contactId } : {}),
          } satisfies OutreachDraftPayload,
          dedupeKey: `outreach.draft:${target.companyId}`,
        },
        db
      );
      if (job) queued += 1;
    }

    await logAction(
      {
        action: "outreach.batch_queued",
        actor: "isaac",
        metadata: { requested: targets.length, queued },
      },
      db
    );

    return NextResponse.json({ ok: true, queued, requested: targets.length });
  } catch (err) {
    if (
      err instanceof NexusNotConfiguredError ||
      err instanceof NexusSchemaMissingError
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed to queue drafts";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
