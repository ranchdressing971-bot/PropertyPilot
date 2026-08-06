import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  enqueueJob,
  logAction,
  NexusNotConfiguredError,
  NexusSchemaMissingError,
  requireNexusDb,
} from "@/lib/nexus/jobs";
import { isPlacesConfigured } from "@/lib/nexus/hands/lead";
import type { LeadSearchPayload } from "@/lib/nexus/types";

export const dynamic = "force-dynamic";

/** Queue a Lead Hand search. The scheduler picks it up on the next tick. */
export async function POST(request: Request) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isPlacesConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_PLACES_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { query?: string; maxResults?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "A search query is required" },
      { status: 400 }
    );
  }

  // Cap the result ceiling so a typo can't run up Places spend.
  const maxResults = Math.min(Math.max(body.maxResults ?? 60, 1), 300);

  try {
    const db = requireNexusDb();
    const job = await enqueueJob(
      {
        type: "lead.search",
        payload: { query, maxResults } satisfies LeadSearchPayload,
        // One pending search per query at a time.
        dedupeKey: `lead.search:${query.toLowerCase()}`,
      },
      db
    );

    if (!job) {
      return NextResponse.json({
        ok: true,
        queued: false,
        message: "That search is already queued",
      });
    }

    await logAction(
      {
        action: "lead.search_queued",
        actor: "isaac",
        entityType: "job",
        entityId: job.id,
        metadata: { query, maxResults },
      },
      db
    );

    return NextResponse.json({ ok: true, queued: true, jobId: job.id });
  } catch (err) {
    if (
      err instanceof NexusNotConfiguredError ||
      err instanceof NexusSchemaMissingError
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed to queue search";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
