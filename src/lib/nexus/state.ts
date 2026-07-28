import { getNexusDb, isMissingSchemaError } from "./jobs";
import type { NexusAction, NexusCompany, NexusJob } from "./types";

/** Aggregate read model behind the /nexus dashboard. */

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

  const companies = (companiesRes.data ?? []) as NexusCompany[];
  const stageCounts: Record<string, number> = {};
  for (const company of companies) {
    stageCounts[company.stage] = (stageCounts[company.stage] ?? 0) + 1;
  }

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
  };
}
