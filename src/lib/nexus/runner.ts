import {
  claimJobs,
  completeJob,
  enqueueJob,
  failJob,
  logAction,
  releaseJob,
  requeueStaleJobs,
  requireNexusDb,
} from "./jobs";
import { runLeadSearch, runLeadScore } from "./hands/lead";
import { runResearchCompany } from "./hands/research";
import { runOutreachDraft, runOutreachReview } from "./hands/outreach";
import { maxReviewCount } from "./lead-filter";
import type {
  LeadSearchPayload,
  LeadScorePayload,
  OutreachDraftPayload,
  OutreachReviewPayload,
  ResearchCompanyPayload,
} from "./types";

/**
 * Job runner. Claims a small batch, dispatches each job to its hand, and stops
 * before the serverless function is killed. Anything left stays queued for the
 * next tick, so throughput is a function of tick frequency rather than how long
 * one request can survive.
 */

/**
 * Wall-clock budget per tick. Vercel kills functions at 60s (see vercel.json),
 * so we stop claiming new work with time to spare for cleanup.
 */
const TIME_BUDGET_MS = 50_000;
const BATCH_SIZE = 5;

/**
 * Worst-case duration per job type. A job is only started when at least this
 * much budget remains, because checking "are we past the deadline" after the
 * fact is useless when a single job can run for half a minute: two back-to-back
 * crawls would sail past the function timeout and lose their completion writes.
 */
const RESERVE_MS: Record<string, number> = {
  "lead.search": 15_000,
  "lead.score": 8_000,
  "research.company": 30_000,
  "outreach.draft": 25_000,
  "outreach.review": 20_000,
};
const DEFAULT_RESERVE_MS = 20_000;

function reserveFor(jobType: string): number {
  return RESERVE_MS[jobType] ?? DEFAULT_RESERVE_MS;
}

export interface TickResult {
  processed: number;
  succeeded: number;
  failed: number;
  requeuedStale: number;
  results: Array<{
    id: string;
    type: string;
    ok: boolean;
    detail: string;
  }>;
  budgetExhausted: boolean;
}

export async function runTick(): Promise<TickResult> {
  const db = requireNexusDb();
  const startedAt = Date.now();

  const result: TickResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    requeuedStale: 0,
    results: [],
    budgetExhausted: false,
  };

  // Jobs whose worker died mid-run would sit in 'running' forever otherwise.
  result.requeuedStale = await requeueStaleJobs(10, db);

  // Catch drafts that were created before auto-review existed, or whose review
  // job was lost — queue AI review so the pipeline doesn't stall on "pending".
  const { data: pendingDrafts } = await db
    .from("nexus_drafts")
    .select("id")
    .eq("status", "pending_approval")
    .limit(25);
  for (const row of pendingDrafts ?? []) {
    await enqueueJob(
      {
        type: "outreach.review",
        payload: { draftId: row.id } satisfies OutreachReviewPayload,
        dedupeKey: `outreach.review:${row.id}`,
      },
      db
    );
  }

  // Re-score active leads missing a review count, or already over the size cap
  // (e.g. slipped in when Text Search omitted userRatingCount).
  const { data: activeForScore } = await db
    .from("nexus_companies")
    .select("id, metadata, place_id")
    .eq("status", "active")
    .not("place_id", "is", null)
    .limit(40);
  const reviewCap = maxReviewCount();
  let scoreQueued = 0;
  for (const row of activeForScore ?? []) {
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    const count =
      typeof meta.userRatingCount === "number" ? meta.userRatingCount : null;
    const needsScore = count == null || count > reviewCap;
    if (!needsScore) continue;
    await enqueueJob(
      {
        type: "lead.score",
        payload: { companyId: row.id },
        dedupeKey: `lead.score:${row.id}`,
      },
      db
    );
    scoreQueued += 1;
    if (scoreQueued >= 15) break;
  }

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const jobs = await claimJobs(BATCH_SIZE, db);
    if (jobs.length === 0) break;

    for (const job of jobs) {
      // Only start a job if its worst case still fits in the remaining budget.
      // Anything that doesn't fit goes back to the queue untouched.
      const remaining = TIME_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < reserveFor(job.type)) {
        await releaseJob(job, db);
        result.budgetExhausted = true;
        break;
      }

      result.processed += 1;

      try {
        let detail: string;

        switch (job.type) {
          case "lead.search": {
            const handResult = await runLeadSearch(
              job.payload as unknown as LeadSearchPayload,
              db
            );
            detail = handResult.summary;
            await logAction(
              {
                action: "lead.search_completed",
                entityType: "job",
                entityId: job.id,
                metadata: handResult.metadata ?? {},
              },
              db
            );
            break;
          }
          case "lead.score": {
            const handResult = await runLeadScore(
              job.payload as unknown as LeadScorePayload,
              db
            );
            detail = handResult.summary;
            await logAction(
              {
                action: "lead.score_completed",
                entityType: "job",
                entityId: job.id,
                metadata: handResult.metadata ?? {},
              },
              db
            );
            break;
          }
          case "research.company": {
            const handResult = await runResearchCompany(
              job.payload as unknown as ResearchCompanyPayload,
              db
            );
            detail = handResult.summary;
            await logAction(
              {
                action: "research.company_completed",
                entityType: "job",
                entityId: job.id,
                metadata: handResult.metadata ?? {},
              },
              db
            );
            break;
          }
          case "outreach.draft": {
            const handResult = await runOutreachDraft(
              job.payload as unknown as OutreachDraftPayload,
              db
            );
            detail = handResult.summary;
            await logAction(
              {
                action: "outreach.draft_completed",
                entityType: "job",
                entityId: job.id,
                metadata: handResult.metadata ?? {},
              },
              db
            );
            break;
          }
          case "outreach.review": {
            const handResult = await runOutreachReview(
              job.payload as unknown as OutreachReviewPayload,
              db
            );
            detail = handResult.summary;
            await logAction(
              {
                action: "outreach.review_completed",
                entityType: "job",
                entityId: job.id,
                metadata: handResult.metadata ?? {},
              },
              db
            );
            break;
          }
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }

        await completeJob(job.id, db);
        result.succeeded += 1;
        result.results.push({ id: job.id, type: job.type, ok: true, detail });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await failJob(job, message, db);
        result.failed += 1;
        result.results.push({
          id: job.id,
          type: job.type,
          ok: false,
          detail: message,
        });
        await logAction(
          {
            action: "job.failed",
            entityType: "job",
            entityId: job.id,
            metadata: { type: job.type, error: message, attempt: job.attempts },
          },
          db
        );
      }
    }

    if (result.budgetExhausted) break;
  }

  if (Date.now() - startedAt >= TIME_BUDGET_MS) {
    result.budgetExhausted = true;
  }

  return result;
}
