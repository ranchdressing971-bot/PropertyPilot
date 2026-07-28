import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  logAction,
  NexusNotConfiguredError,
  NexusSchemaMissingError,
  requireNexusDb,
} from "@/lib/nexus/jobs";

export const dynamic = "force-dynamic";

/**
 * Approve, reject, or edit a draft.
 *
 * Approving marks a draft as cleared to send; it does not send, because no
 * sending hand exists yet. Rejecting records the reason and, when the reason is
 * that the address is wrong or unwanted, adds a suppression so the address is
 * never drafted for again.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: {
    action?: "approve" | "reject";
    reason?: string;
    subject?: string;
    bodyText?: string;
    suppress?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { ok: false, error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  try {
    const db = requireNexusDb();

    const { data: draft, error: loadError } = await db
      .from("nexus_drafts")
      .select("id, to_email, status, company_id")
      .eq("id", id)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!draft) {
      return NextResponse.json(
        { ok: false, error: "Draft not found" },
        { status: 404 }
      );
    }
    if (draft.status === "sent") {
      return NextResponse.json(
        { ok: false, error: "That draft has already been sent" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const approving = body.action === "approve";

    const { error: updateError } = await db
      .from("nexus_drafts")
      .update({
        status: approving ? "approved" : "rejected",
        // Approving with edits saves the edited copy, not the model's version.
        ...(body.subject ? { subject: body.subject } : {}),
        ...(body.bodyText ? { body: body.bodyText } : {}),
        rejection_reason: approving ? null : (body.reason ?? null),
        reviewed_at: now,
        reviewed_by: admin.email ?? "unknown",
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    // Rejecting because the recipient is wrong should be permanent, otherwise
    // the next batch would just draft for them again.
    if (!approving && body.suppress) {
      // Partial unique index is on lower(email), so check-then-insert rather than
      // upsert onConflict — PostgREST can't target expression indexes cleanly.
      const email = String(draft.to_email).toLowerCase();
      const { data: existing } = await db
        .from("nexus_suppressions")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (!existing) {
        const { error: suppressError } = await db.from("nexus_suppressions").insert({
          email,
          reason: "manual",
          notes: body.reason ?? "Rejected during draft review",
        });
        if (suppressError && suppressError.code !== "23505") {
          console.error("[nexus] suppression insert failed:", suppressError.message);
        }
      }
    }

    await db
      .from("nexus_companies")
      .update({
        stage: approving ? "queued" : "new",
        updated_at: now,
      })
      .eq("id", draft.company_id);

    await logAction(
      {
        action: approving ? "outreach.draft_approved" : "outreach.draft_rejected",
        actor: "isaac",
        entityType: "draft",
        entityId: id,
        metadata: {
          to: draft.to_email,
          reason: body.reason ?? null,
          edited: Boolean(body.subject || body.bodyText),
          suppressed: Boolean(!approving && body.suppress),
        },
      },
      db
    );

    return NextResponse.json({
      ok: true,
      status: approving ? "approved" : "rejected",
      note: approving
        ? "Approved. Nothing sends yet — the sending hand is not built."
        : undefined,
    });
  } catch (err) {
    if (
      err instanceof NexusNotConfiguredError ||
      err instanceof NexusSchemaMissingError
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed to update draft";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
