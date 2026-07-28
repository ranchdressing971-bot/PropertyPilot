import { getNexusDb, isMissingSchemaError } from "./jobs";
import type {
  NexusAction,
  NexusCompany,
  NexusContact,
  NexusDraft,
  NexusJob,
} from "./types";

/** Aggregate read model behind the /nexus dashboard. */

/** A draft joined to the names needed to review it without another lookup. */
export interface DraftWithContext extends NexusDraft {
  company_name: string | null;
  contact_name: string | null;
  source_url: string | null;
}

export interface NexusState {
  configured: boolean;
  schemaReady: boolean;
  error: string | null;
  companies: NexusCompany[];
  companyCount: number;
  jobs: NexusJob[];
  queuedCount: number;
  actions: NexusAction[];
  stageCounts: Record<string, number>;
  contacts: NexusContact[];
  contactCount: number;
  drafts: DraftWithContext[];
  pendingDraftCount: number;
  researchedCount: number;
  /** True when the phase 2 migration has not been run yet. */
  phase2Ready: boolean;
}

const EMPTY: NexusState = {
  configured: false,
  schemaReady: false,
  error: null,
  companies: [],
  companyCount: 0,
  jobs: [],
  queuedCount: 0,
  actions: [],
  stageCounts: {},
  contacts: [],
  contactCount: 0,
  drafts: [],
  pendingDraftCount: 0,
  researchedCount: 0,
  phase2Ready: false,
};

export async function loadNexusState(companyLimit = 100): Promise<NexusState> {
  const db = getNexusDb();
  if (!db) {
    return {
      ...EMPTY,
      error:
        "Supabase service role key missing — add SUPABASE_SERVICE_ROLE_KEY to use Nexus.",
    };
  }

  const [companiesRes, jobsRes, actionsRes, countRes, queuedRes] =
    await Promise.all([
      db
        .from("nexus_companies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(companyLimit),
      db
        .from("nexus_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
      db
        .from("nexus_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      db.from("nexus_companies").select("*", { count: "exact", head: true }),
      db
        .from("nexus_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued"),
    ]);

  const firstError =
    companiesRes.error ?? jobsRes.error ?? actionsRes.error ?? null;

  if (firstError) {
    return {
      ...EMPTY,
      configured: true,
      error: isMissingSchemaError(firstError)
        ? "Nexus tables are not installed. Run docs/NEXUS_SCHEMA.sql in Supabase → SQL Editor."
        : firstError.message,
    };
  }

  const companies = ((companiesRes.data ?? []) as NexusCompany[]).map((row) => ({
    ...row,
    // Defaults for rows that exist before the phase 2 migration is applied.
    research_status: row.research_status ?? "pending",
    research_error: row.research_error ?? null,
    research_pages: row.research_pages ?? 0,
  }));
  const stageCounts: Record<string, number> = {};
  for (const company of companies) {
    stageCounts[company.stage] = (stageCounts[company.stage] ?? 0) + 1;
  }

  // Phase 2 tables are queried separately so a dashboard still renders for
  // someone who has run the first migration but not the second.
  const [contactsRes, contactCountRes, draftsRes, pendingDraftRes, researchedRes] =
    await Promise.all([
      db
        .from("nexus_contacts")
        .select("*")
        .order("confidence", { ascending: false })
        .limit(100),
      db.from("nexus_contacts").select("*", { count: "exact", head: true }),
      db
        .from("nexus_drafts")
        .select("*, nexus_companies(name), nexus_contacts(name, source_url)")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("nexus_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval"),
      db
        .from("nexus_companies")
        .select("*", { count: "exact", head: true })
        .eq("research_status", "done"),
    ]);

  const phase2Error = draftsRes.error ?? researchedRes.error ?? null;
  const phase2Ready = !(phase2Error && isMissingSchemaError(phase2Error));

  type DraftRow = NexusDraft & {
    nexus_companies?: { name?: string | null } | null;
    nexus_contacts?: { name?: string | null; source_url?: string | null } | null;
  };

  const drafts: DraftWithContext[] = ((draftsRes.data ?? []) as DraftRow[]).map(
    (row) => {
      const { nexus_companies, nexus_contacts, ...draft } = row;
      return {
        ...draft,
        company_name: nexus_companies?.name ?? null,
        contact_name: nexus_contacts?.name ?? null,
        source_url: nexus_contacts?.source_url ?? null,
      };
    }
  );

  return {
    configured: true,
    schemaReady: true,
    error: null,
    companies,
    companyCount: countRes.count ?? companies.length,
    jobs: (jobsRes.data ?? []) as NexusJob[],
    queuedCount: queuedRes.count ?? 0,
    actions: (actionsRes.data ?? []) as NexusAction[],
    stageCounts,
    contacts: (contactsRes.data ?? []) as NexusContact[],
    contactCount: contactCountRes.count ?? 0,
    drafts,
    pendingDraftCount: pendingDraftRes.count ?? 0,
    researchedCount: researchedRes.count ?? 0,
    phase2Ready,
  };
}
