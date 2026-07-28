import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NexusJob } from "./types";

/**
 * Atlas job queue.
 *
 * Every hand runs as a queued job rather than inside the request that triggered
 * it, because serverless functions are killed at 60s. A scheduler pings the
 * runner, the runner claims a small batch, and unfinished work stays queued.
 */

/** Retry backoff in seconds, indexed by attempt count. */
const BACKOFF_SECONDS = [30, 120, 600, 1800, 7200];

export function getNexusDb(): SupabaseClient | null {
  return createAdminClient();
}

export class NexusNotConfiguredError extends Error {
  constructor() {
    super(
      "Nexus requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL. " +
        "Add them, then run docs/NEXUS_SCHEMA.sql."
    );
    this.name = "NexusNotConfiguredError";
  }
}

export class NexusSchemaMissingError extends Error {
  constructor() {
    super(
      "Nexus tables are not installed. Run docs/NEXUS_SCHEMA.sql in Supabase → SQL Editor."
    );
    this.name = "NexusSchemaMissingError";
  }
}

/**
 * True when Postgres/PostgREST is reporting a missing table or function rather
 * than a real failure — i.e. the migration has not been run yet.
 */
export function isMissingSchemaError(error: {
  code?: string;
  message?: string;
}): boolean {
  // 42P01 = undefined_table, 42883 = undefined_function,
  // PGRST202 = function not found in the PostgREST schema cache
  if (error.code === "42P01" || error.code === "42883" || error.code === "PGRST202") {
    return true;
  }
  const message = error.message ?? "";
  return (
    message.includes("does not exist") || message.includes("in the schema cache")
  );
}

export function requireNexusDb(): SupabaseClient {
  const db = getNexusDb();
  if (!db) throw new NexusNotConfiguredError();
  return db;
}

export interface EnqueueOptions {
  type: string;
  payload?: Record<string, unknown>;
  /** Delay before the job becomes claimable */
  delaySeconds?: number;
  maxAttempts?: number;
  /**
   * Unique key reserved only while the job is outstanding. Enqueueing the same
   * key twice is a no-op, but the key is released once the job settles so the
   * same work can be run again later.
   */
  dedupeKey?: string;
}

/**
 * Queue a job. Returns null when a dedupeKey collides, which callers can treat
 * as "already scheduled" rather than an error.
 */
export async function enqueueJob(
  options: EnqueueOptions,
  db: SupabaseClient = requireNexusDb()
): Promise<NexusJob | null> {
  const runAfter = new Date(
    Date.now() + (options.delaySeconds ?? 0) * 1000
  ).toISOString();

  const { data, error } = await db
    .from("nexus_jobs")
    .insert({
      type: options.type,
      payload: options.payload ?? {},
      run_after: runAfter,
      max_attempts: options.maxAttempts ?? 5,
      dedupe_key: options.dedupeKey ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation on dedupe_key: the work is already scheduled.
    if (error.code === "23505") return null;
    if (isMissingSchemaError(error)) throw new NexusSchemaMissingError();
    throw new Error(`Failed to enqueue ${options.type}: ${error.message}`);
  }

  return data as NexusJob;
}

/**
 * Atomically claim up to `batchSize` due jobs via the nexus_claim_jobs function,
 * which uses `for update skip locked` so two overlapping ticks can never take
 * the same job.
 */
export async function claimJobs(
  batchSize: number,
  db: SupabaseClient = requireNexusDb()
): Promise<NexusJob[]> {
  const { data, error } = await db.rpc("nexus_claim_jobs", {
    batch_size: batchSize,
  });

  if (error) {
    if (isMissingSchemaError(error)) throw new NexusSchemaMissingError();
    throw new Error(`Failed to claim jobs: ${error.message}`);
  }

  return (data ?? []) as NexusJob[];
}

export async function completeJob(
  jobId: string,
  db: SupabaseClient = requireNexusDb()
): Promise<void> {
  const { error } = await db
    .from("nexus_jobs")
    .update({
      status: "done",
      locked_at: null,
      last_error: null,
      // Release the dedupe key so the same work can be queued again later.
      dedupe_key: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to complete job: ${error.message}`);
}

/**
 * Record a failure. Retries with exponential backoff until max_attempts, then
 * dead-letters the job as 'failed' so it stops consuming ticks but stays
 * visible for inspection.
 */
export async function failJob(
  job: NexusJob,
  message: string,
  db: SupabaseClient = requireNexusDb()
): Promise<void> {
  const exhausted = job.attempts >= job.max_attempts;
  const backoff =
    BACKOFF_SECONDS[Math.min(job.attempts - 1, BACKOFF_SECONDS.length - 1)] ??
    3600;

  const { error } = await db
    .from("nexus_jobs")
    .update({
      status: exhausted ? "failed" : "queued",
      locked_at: null,
      last_error: message.slice(0, 2000),
      run_after: exhausted
        ? job.run_after
        : new Date(Date.now() + backoff * 1000).toISOString(),
      // Keep the key reserved while retries are pending; release it once the
      // job is dead so the work can be queued again by hand.
      ...(exhausted ? { dedupe_key: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) throw new Error(`Failed to mark job failed: ${error.message}`);
}

/** Release jobs whose worker died mid-run so they can be retried. */
export async function requeueStaleJobs(
  staleMinutes = 10,
  db: SupabaseClient = requireNexusDb()
): Promise<number> {
  const { data, error } = await db.rpc("nexus_requeue_stale_jobs", {
    stale_minutes: staleMinutes,
  });

  if (error) {
    if (isMissingSchemaError(error)) throw new NexusSchemaMissingError();
    throw new Error(`Failed to requeue stale jobs: ${error.message}`);
  }
  return (data as number) ?? 0;
}

export interface LogActionOptions {
  action: string;
  actor?: "nexus" | "isaac";
  entityType?: string;
  entityId?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Append to the action log. Never throws — a logging failure must not roll back
 * real work, but it is surfaced on the server console.
 */
export async function logAction(
  options: LogActionOptions,
  db: SupabaseClient = requireNexusDb()
): Promise<void> {
  const { error } = await db.from("nexus_actions").insert({
    actor: options.actor ?? "nexus",
    action: options.action,
    entity_type: options.entityType ?? null,
    entity_id: options.entityId ?? null,
    confidence: options.confidence ?? null,
    metadata: options.metadata ?? {},
  });

  if (error) {
    console.error(`[nexus] failed to log action "${options.action}":`, error.message);
  }
}
