/** Shared Nexus / Atlas types. */

export type JobType =
  | "lead.search"
  | "lead.score"
  | "research.company"
  | "outreach.draft"
  | "outreach.review"
  | "outreach.send";

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
  research_status: ResearchStatus | string;
  research_error: string | null;
  research_pages: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ResearchStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface NexusContact {
  id: string;
  company_id: string;
  email: string;
  name: string | null;
  role: string | null;
  source_url: string | null;
  confidence: number;
  verified_at: string | null;
  created_at: string;
}

export type DraftStatus = "pending_approval" | "approved" | "rejected" | "sent";

export interface NexusDraft {
  id: string;
  company_id: string;
  contact_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  model: string | null;
  status: DraftStatus | string;
  confidence: number | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sent_at: string | null;
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

/** Payload for a Lead Hand size re-check via Place Details. */
export interface LeadScorePayload {
  companyId: string;
}

/** Payload for a Research Hand crawl of one company website. */
export interface ResearchCompanyPayload {
  companyId: string;
  /** Hard cap on pages fetched, so one sprawling site can't eat a whole tick. */
  maxPages?: number;
}

/** Payload for an Outreach Hand draft. Drafting only — never sends. */
export interface OutreachDraftPayload {
  companyId: string;
  /** Specific recipient; when omitted the highest-confidence contact is used. */
  contactId?: string;
}

/** Payload for AI review of a draft before it becomes send-ready. */
export interface OutreachReviewPayload {
  draftId: string;
}

/** Payload for Mailtrap (or later Gmail) delivery of an approved draft. */
export interface OutreachSendPayload {
  draftId: string;
}

/** What a hand reports back to the runner. */
export interface HandResult {
  summary: string;
  metadata?: Record<string, unknown>;
}
