import {
  claimJobs,
  completeJob,
  failJob,
  logAction,
  requeueStaleJobs,
  requireNexusDb,
} from "./jobs";
import { runLeadSearch } from "./hands/lead";
import type { LeadSearchPayload } from "./types";

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

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const jobs = await claimJobs(BATCH_SIZE, db);
    if (jobs.length === 0) break;

    for (const job of jobs) {
      // Re-check the clock inside the batch: one slow job shouldn't push the
      // whole tick past the timeout and lose the others' completion writes.
      if (Date.now() - startedAt >= TIME_BUDGET_MS) {
        await failJob(job, "Tick budget exhausted before start; requeued", db);
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
