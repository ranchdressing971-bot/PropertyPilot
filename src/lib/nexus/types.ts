/** Shared Nexus / Atlas types. */

export type JobType = "lead.search";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface NexusJob {
  id: string;
  type: JobType | string;
  payload: Record<string, unknown>;
  status: JobStatus;
  run_after: string;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  last_error: string | null;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyStage =
  | "new"
  | "researching"
  | "ready"
  | "queued"
  | "contacted"
  | "replied"
  | "won"
  | "lost";

export interface NexusCompany {
  id: string;
  place_id: string | null;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  source: string;
  search_query: string | null;
  stage: CompanyStage | string;
  status: string;
  disqualified_reason: string | null;
  places_synced_at: string | null;
  researched_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NexusAction {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Payload for a Lead Hand search job. */
export interface LeadSearchPayload {
  /** Free-text Places query, e.g. "HOA management company in Austin TX" */
  query: string;
  /** Stop after this many companies stored (guards API spend) */
  maxResults?: number;
  /** Places pagination cursor, set when the hand requeues itself */
  pageToken?: string;
  /** Running total across requeued pages */
  storedSoFar?: number;
}

/** What a hand reports back to the runner. */
export interface HandResult {
  summary: string;
  metadata?: Record<string, unknown>;
}
