/**
 * Match outreach sends → RideBy signups so Nova can learn what works.
 *
 * Hard conversion: lower(sent draft email) = lower(profile email)
 * and profile.created_at >= draft.sent_at.
 *
 * Soft signal: HOA name ≈ company name (reported separately, not counted as won).
 */

import { getNexusDb, requireNexusDb } from "@/lib/nexus/jobs";

export interface ConversionMatch {
  draftId: string;
  email: string;
  subject: string;
  companyId: string;
  companyName: string;
  city: string | null;
  sentAt: string;
  signedUpAt: string;
  profileId: string;
  hoaName: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  daysToSignup: number;
}

export interface SoftNameMatch {
  profileId: string;
  hoaName: string;
  companyId: string;
  companyName: string;
  signedUpAt: string;
  reason: string;
}

export interface ConversionReport {
  sinceDays: number;
  sentCount: number;
  matchedCount: number;
  conversionRate: number;
  avgDaysToSignup: number | null;
  matches: ConversionMatch[];
  bySubject: Array<{ subject: string; sent: number; converted: number; rate: number }>;
  byCity: Array<{ city: string; sent: number; converted: number; rate: number }>;
  softNameMatches: SoftNameMatch[];
  recentSignups: Array<{
    email: string | null;
    hoaName: string | null;
    createdAt: string;
    plan: string | null;
    matchedOutreach: boolean;
  }>;
  appContext: {
    whatWeMatch: string;
    tables: string[];
  };
}

type SentDraftRow = {
  id: string;
  to_email: string | null;
  subject: string | null;
  sent_at: string | null;
  company_id: string;
  company?:
    | { id: string; name: string; city: string | null; stage: string | null }
    | { id: string; name: string; city: string | null; stage: string | null }[]
    | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  hoa_name: string | null;
  created_at: string;
  plan: string | null;
  subscription_status: string | null;
};

function normEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(hoa|inc|llc|corp|company|management|assoc|association|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 6 && nb.includes(na)) return true;
  if (nb.length >= 6 && na.includes(nb)) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 2));
  const wb = nb.split(" ").filter((w) => w.length > 2);
  if (wa.size === 0 || wb.length === 0) return false;
  const overlap = wb.filter((w) => wa.has(w)).length;
  return overlap >= 2 || (overlap === 1 && Math.min(wa.size, wb.length) === 1);
}

function daysBetween(earlier: string, later: string): number {
  const ms = new Date(later).getTime() - new Date(earlier).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function unwrapCompany(
  company: SentDraftRow["company"]
): { id: string; name: string; city: string | null; stage: string | null } | null {
  if (!company) return null;
  return Array.isArray(company) ? company[0] ?? null : company;
}

function rate(converted: number, sent: number): number {
  if (sent <= 0) return 0;
  return Math.round((converted / sent) * 1000) / 10;
}

/**
 * Load conversion report for Nova (and status UI).
 */
export async function loadConversionReport(options?: {
  sinceDays?: number;
  limit?: number;
  syncWins?: boolean;
}): Promise<ConversionReport> {
  const sinceDays = Math.min(365, Math.max(7, options?.sinceDays ?? 90));
  const limit = Math.min(50, Math.max(5, options?.limit ?? 20));
  const syncWins = options?.syncWins ?? true;

  const empty: ConversionReport = {
    sinceDays,
    sentCount: 0,
    matchedCount: 0,
    conversionRate: 0,
    avgDaysToSignup: null,
    matches: [],
    bySubject: [],
    byCity: [],
    softNameMatches: [],
    recentSignups: [],
    appContext: {
      whatWeMatch:
        "Sent nexus_drafts.to_email → profiles.email when signup is after the send. Soft: hoa_name ≈ company name.",
      tables: [
        "nexus_drafts (outreach emails)",
        "nexus_companies (leads)",
        "profiles (RideBy signups)",
        "community_trials (free trials claimed)",
      ],
    },
  };

  const db = getNexusDb();
  if (!db) return empty;

  const sinceIso = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: draftData, error: draftErr } = await db
    .from("nexus_drafts")
    .select(
      "id, to_email, subject, sent_at, company_id, company:nexus_companies(id, name, city, stage)"
    )
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(500);

  if (draftErr) {
    console.error("conversions drafts:", draftErr.message);
    return { ...empty, appContext: { ...empty.appContext, whatWeMatch: draftErr.message } };
  }

  const drafts = (draftData ?? []) as SentDraftRow[];
  const sentCount = drafts.length;

  const { data: profileData, error: profileErr } = await db
    .from("profiles")
    .select("id, email, hoa_name, created_at, plan, subscription_status")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (profileErr) {
    console.error("conversions profiles:", profileErr.message);
    return {
      ...empty,
      sentCount,
      appContext: { ...empty.appContext, whatWeMatch: profileErr.message },
    };
  }

  const profiles = (profileData ?? []) as ProfileRow[];

  // Latest send before each signup wins attribution.
  const draftsByEmail = new Map<string, SentDraftRow[]>();
  for (const d of drafts) {
    const email = normEmail(d.to_email);
    if (!email) continue;
    const list = draftsByEmail.get(email) ?? [];
    list.push(d);
    draftsByEmail.set(email, list);
  }
  for (const list of draftsByEmail.values()) {
    list.sort(
      (a, b) =>
        new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime()
    );
  }

  const matches: ConversionMatch[] = [];
  const matchedDraftIds = new Set<string>();
  const matchedProfileIds = new Set<string>();

  for (const profile of profiles) {
    const email = normEmail(profile.email);
    if (!email) continue;
    const candidates = draftsByEmail.get(email);
    if (!candidates?.length) continue;

    const signupMs = new Date(profile.created_at).getTime();
    const prior = candidates.find((d) => {
      if (!d.sent_at) return false;
      return new Date(d.sent_at).getTime() <= signupMs;
    });
    if (!prior?.sent_at) continue;

    const company = unwrapCompany(prior.company);
    matches.push({
      draftId: prior.id,
      email,
      subject: prior.subject ?? "(no subject)",
      companyId: prior.company_id,
      companyName: company?.name ?? "Unknown",
      city: company?.city ?? null,
      sentAt: prior.sent_at,
      signedUpAt: profile.created_at,
      profileId: profile.id,
      hoaName: profile.hoa_name,
      plan: profile.plan,
      subscriptionStatus: profile.subscription_status,
      daysToSignup: daysBetween(prior.sent_at, profile.created_at),
    });
    matchedDraftIds.add(prior.id);
    matchedProfileIds.add(profile.id);
  }

  matches.sort(
    (a, b) =>
      new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime()
  );

  // Soft name matches for unmatched signups.
  const emailedCompanies = drafts
    .map((d) => {
      const c = unwrapCompany(d.company);
      return c ? { id: c.id, name: c.name } : null;
    })
    .filter((c): c is { id: string; name: string } => Boolean(c));

  const softNameMatches: SoftNameMatch[] = [];
  for (const profile of profiles) {
    if (matchedProfileIds.has(profile.id)) continue;
    if (!profile.hoa_name) continue;
    const hit = emailedCompanies.find((c) =>
      namesLikelyMatch(profile.hoa_name!, c.name)
    );
    if (!hit) continue;
    softNameMatches.push({
      profileId: profile.id,
      hoaName: profile.hoa_name,
      companyId: hit.id,
      companyName: hit.name,
      signedUpAt: profile.created_at,
      reason: "hoa_name ≈ company name (email did not match a sent draft)",
    });
    if (softNameMatches.length >= 10) break;
  }

  // Subject / city rollups from all sends in window.
  const subjectStats = new Map<string, { sent: number; converted: number }>();
  const cityStats = new Map<string, { sent: number; converted: number }>();
  for (const d of drafts) {
    const subject = (d.subject ?? "(no subject)").trim() || "(no subject)";
    const company = unwrapCompany(d.company);
    const city = (company?.city ?? "unknown").trim() || "unknown";
    const s = subjectStats.get(subject) ?? { sent: 0, converted: 0 };
    s.sent += 1;
    if (matchedDraftIds.has(d.id)) s.converted += 1;
    subjectStats.set(subject, s);
    const c = cityStats.get(city) ?? { sent: 0, converted: 0 };
    c.sent += 1;
    if (matchedDraftIds.has(d.id)) c.converted += 1;
    cityStats.set(city, c);
  }

  const bySubject = [...subjectStats.entries()]
    .map(([subject, v]) => ({
      subject,
      sent: v.sent,
      converted: v.converted,
      rate: rate(v.converted, v.sent),
    }))
    .sort((a, b) => b.converted - a.converted || b.sent - a.sent)
    .slice(0, 8);

  const byCity = [...cityStats.entries()]
    .map(([city, v]) => ({
      city,
      sent: v.sent,
      converted: v.converted,
      rate: rate(v.converted, v.sent),
    }))
    .sort((a, b) => b.converted - a.converted || b.sent - a.sent)
    .slice(0, 8);

  const avgDaysToSignup =
    matches.length > 0
      ? Math.round(
          (matches.reduce((sum, m) => sum + m.daysToSignup, 0) / matches.length) *
            10
        ) / 10
      : null;

  if (syncWins && matches.length > 0) {
    await syncConversionWins(matches).catch((err) => {
      console.error("syncConversionWins:", err);
    });
  }

  return {
    sinceDays,
    sentCount,
    matchedCount: matches.length,
    conversionRate: rate(matches.length, sentCount),
    avgDaysToSignup,
    matches: matches.slice(0, limit),
    bySubject,
    byCity,
    softNameMatches,
    recentSignups: profiles.slice(0, 12).map((p) => ({
      email: p.email,
      hoaName: p.hoa_name,
      createdAt: p.created_at,
      plan: p.plan,
      matchedOutreach: matchedProfileIds.has(p.id),
    })),
    appContext: empty.appContext,
  };
}

/** Lightweight counts for status cockpit / toolStatus. */
export async function loadConversionSummary(sinceDays = 90): Promise<{
  sinceDays: number;
  sentCount: number;
  matchedCount: number;
  conversionRate: number;
  recentSignupCount: number;
}> {
  const report = await loadConversionReport({
    sinceDays,
    limit: 5,
    syncWins: false,
  });
  return {
    sinceDays: report.sinceDays,
    sentCount: report.sentCount,
    matchedCount: report.matchedCount,
    conversionRate: report.conversionRate,
    recentSignupCount: report.recentSignups.length,
  };
}

/**
 * Mark matched companies as won + log outreach.converted (idempotent-ish).
 */
async function syncConversionWins(matches: ConversionMatch[]): Promise<void> {
  const db = requireNexusDb();

  for (const match of matches.slice(0, 40)) {
    await db
      .from("nexus_companies")
      .update({
        stage: "won",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.companyId)
      .neq("stage", "won");

    // Avoid spamming actions: only insert if none exists for this draft.
    const { data: existing } = await db
      .from("nexus_actions")
      .select("id")
      .eq("action", "outreach.converted")
      .eq("entity_id", match.draftId)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await db.from("nexus_actions").insert({
      actor: "nova",
      action: "outreach.converted",
      entity_type: "draft",
      entity_id: match.draftId,
      metadata: {
        email: match.email,
        profileId: match.profileId,
        companyId: match.companyId,
        sentAt: match.sentAt,
        signedUpAt: match.signedUpAt,
        daysToSignup: match.daysToSignup,
        subject: match.subject,
      },
    });
  }
}
