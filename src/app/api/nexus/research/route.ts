import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  enqueueJob,
  logAction,
  NexusNotConfiguredError,
  NexusSchemaMissingError,
  requireNexusDb,
} from "@/lib/nexus/jobs";
import type { ResearchCompanyPayload } from "@/lib/nexus/types";

export const dynamic = "force-dynamic";

/** Cap per request so one click can't queue thousands of crawls. */
const MAX_BATCH = 50;

/**
 * Queue Research Hand crawls. Either one company by id, or the next N companies
 * that have a website and have not been researched yet.
 */
export async function POST(request: Request) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { companyId?: string; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const db = requireNexusDb();

    let companyIds: string[];

    if (body.companyId) {
      companyIds = [body.companyId];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 10, 1), MAX_BATCH);
      const { data, error } = await db
        .from("nexus_companies")
        .select("id")
        .eq("status", "active")
        .eq("research_status", "pending")
        .not("website", "is", null)
        // Prefer local-looking firms: city filled, already past the national filter.
        .not("city", "is", null)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) throw new Error(error.message);
      companyIds = (data ?? []).map((row) => row.id as string);
    }

    if (companyIds.length === 0) {
      return NextResponse.json({
        ok: true,
        queued: 0,
        message: "Nothing left to research",
      });
    }

    let queued = 0;
    for (const companyId of companyIds) {
      const job = await enqueueJob(
        {
          type: "research.company",
          payload: { companyId } satisfies ResearchCompanyPayload,
          // One outstanding crawl per company.
          dedupeKey: `research.company:${companyId}`,
        },
        db
      );
      if (job) queued += 1;
    }

    await logAction(
      {
        action: "research.batch_queued",
        actor: "isaac",
        metadata: { requested: companyIds.length, queued },
      },
      db
    );

    return NextResponse.json({ ok: true, queued, requested: companyIds.length });
  } catch (err) {
    if (
      err instanceof NexusNotConfiguredError ||
      err instanceof NexusSchemaMissingError
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed to queue research";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
