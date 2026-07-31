/**
 * Match outreach → RideBy signups and build a rich learning dossier
 * so Nova can see what worked and hypothesize why.
 */

import { getNexusDb, requireNexusDb } from "@/lib/nexus/jobs";
import {
  isActiveSubscriptionStatus,
  loadSubscriptionEvents,
  resolveSubscriptionTiming,
  type SubscribedAtSource,
} from "./subscription-events";

export interface ConversionMatch {
  draftId: string;
  email: string;
  subject: string;
  bodyExcerpt: string;
  companyId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  reviewCount: number | null;
  contactName: string | null;
  contactRole: string | null;
  draftConfidence: number | null;
  sentAt: string;
  signedUpAt: string;
  profileId: string;
  hoaName: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  daysToSignup: number;
  isSubscribed: boolean;
  subscribedAt: string | null;
  subscribedAtSource: SubscribedAtSource | null;
  daysToSubscribe: number | null;
  conversionPath: "signup_only" | "signup_and_subscribed" | "subscribed_after_outreach";
  features: MessageFeatures;
  whyHints: string[];
}

export interface SoftNameMatch {
  profileId: string;
  hoaName: string;
  companyId: string;
  companyName: string;
  signedUpAt: string;
  isSubscribed: boolean;
  subscribedAt: string | null;
  plan: string | null;
  reason: string;
}

export interface MessageFeatures {
  subjectLength: number;
  bodyLength: number;
  bodyWords: number;
  hourEt: number | null;
  weekdayEt: string | null;
  hasQuestionSubject: boolean;
  mentionsFirstName: boolean;
  mentionsCity: boolean;
  themes: string[];
  reviewBucket: string;
  confidenceBucket: string;
  bodyLengthBucket: string;
}

export interface StatBucket {
  key: string;
  sent: number;
  converted: number;
  rate: number;
}

export interface LearningReport {
  sinceDays: number;
  sentCount: number;
  matchedCount: number;
  conversionRate: number;
  paidOrActiveConverts: number;
  subscribedCount: number;
  subscriptionRate: number;
  avgDaysToSignup: number | null;
  medianDaysToSignup: number | null;
  avgDaysToSubscribe: number | null;
  medianDaysToSubscribe: number | null;
  matches: ConversionMatch[];
  nonConvertedSample: Array<{
    draftId: string;
    email: string;
    subject: string;
    bodyExcerpt: string;
    companyName: string;
    city: string | null;
    reviewCount: number | null;
    sentAt: string;
    features: MessageFeatures;
  }>;
  bySubject: StatBucket[];
  byCity: StatBucket[];
  byState: StatBucket[];
  byHourEt: StatBucket[];
  byWeekday: StatBucket[];
  byTheme: StatBucket[];
  byReviewBucket: StatBucket[];
  byBodyLength: StatBucket[];
  byConfidence: StatBucket[];
  byThemeSubscribed: StatBucket[];
  bySubjectSubscribed: StatBucket[];
  winnersVsLosers: {
    avgBodyWordsConverted: number | null;
    avgBodyWordsNotConverted: number | null;
    avgReviewsConverted: number | null;
    avgReviewsNotConverted: number | null;
    topThemesConverted: string[];
    topThemesNotConverted: string[];
    bestHoursEt: string[];
    bestWeekdays: string[];
  };
  funnel: {
    activeCompanies: number;
    contacts: number;
    pendingDrafts: number;
    approvedDrafts: number;
    sentDrafts: number;
    rejectedDrafts: number;
    converted: number;
    subscribed: number;
    wonCompanies: number;
    suppressions: number;
  };
  subscriptionFunnel: {
    emailed: number;
    signedUp: number;
    subscribed: number;
    signupRate: number;
    subscribeRate: number;
  };
  rejections: Array<{ reason: string; count: number }>;
  softNameMatches: SoftNameMatch[];
  recentSignups: Array<{
    email: string | null;
    hoaName: string | null;
    createdAt: string;
    plan: string | null;
    subscriptionStatus: string | null;
    matchedOutreach: boolean;
    isSubscribed: boolean;
    subscribedAt: string | null;
  }>;
  recentSubscribers: Array<{
    email: string | null;
    hoaName: string | null;
    plan: string | null;
    subscriptionStatus: string | null;
    subscribedAt: string | null;
    subscribedAtSource: SubscribedAtSource | null;
    matchedOutreach: boolean;
    outreachSubject: string | null;
    daysFromEmailToSubscribe: number | null;
  }>;
  recentTrials: Array<{
    hoaName: string;
    communityKey: string;
    claimedAt: string;
  }>;
  recentActions: Array<{
    action: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  insights: string[];
  appContext: {
    whatWeMatch: string;
    tables: string[];
    howToLearn: string;
  };
}

/** @deprecated alias — use LearningReport */
export type ConversionReport = LearningReport;

type CompanyJoin = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  stage: string | null;
  metadata: Record<string, unknown> | null;
};

type ContactJoin = {
  id: string;
  name: string | null;
  role: string | null;
};

type SentDraftRow = {
  id: string;
  to_email: string | null;
  subject: string | null;
  body: string | null;
  confidence: number | null;
  sent_at: string | null;
  company_id: string;
  contact_id: string | null;
  company?: CompanyJoin | CompanyJoin[] | null;
  contact?: ContactJoin | ContactJoin[] | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  hoa_name: string | null;
  created_at: string;
  plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  community_key: string | null;
};

type TrialClaimRow = {
  claimed_by: string | null;
  claimed_at: string;
  hoa_name: string;
  community_key: string;
};

const THEMES: Array<{ key: string; re: RegExp }> = [
  { key: "drive_through", re: /\bdrive[-\s]?through\b/i },
  { key: "inspection", re: /\binspect(ion|ions|ing)?\b/i },
  { key: "trial_or_free", re: /\b(free|trial|no.?cost)\b/i },
  { key: "violations", re: /\b(violation|compliance|ccr|covenant)\b/i },
  { key: "video", re: /\bvideo\b/i },
  { key: "reviews_proof", re: /\b(review|google|rating)\b/i },
  { key: "board_manager", re: /\b(board|manager|property manager)\b/i },
  { key: "neighborhood", re: /\b(neighborhood|community|hoa)\b/i },
  { key: "time_save", re: /\b(save time|faster|hours|manual)\b/i },
  { key: "question_cta", re: /\?/ },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function normEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(hoa|inc|llc|corp|company|management|assoc|association|the)\b/g,
      " "
    )
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

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function rate(converted: number, sent: number): number {
  if (sent <= 0) return 0;
  return Math.round((converted / sent) * 1000) / 10;
}

function excerpt(text: string | null | undefined, max = 220): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function reviewCountOf(meta: Record<string, unknown> | null | undefined): number | null {
  const raw = meta?.userRatingCount ?? meta?.user_rating_count ?? meta?.reviews;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function reviewBucket(n: number | null): string {
  if (n == null) return "unknown";
  if (n <= 5) return "0-5";
  if (n <= 20) return "6-20";
  if (n <= 75) return "21-75";
  return "75+";
}

function bodyLengthBucket(words: number): string {
  if (words < 60) return "short_<60w";
  if (words < 120) return "medium_60-119w";
  if (words < 200) return "long_120-199w";
  return "very_long_200w+";
}

function confidenceBucket(c: number | null): string {
  if (c == null) return "unknown";
  if (c < 50) return "low_<50";
  if (c < 75) return "mid_50-74";
  return "high_75+";
}

function etParts(iso: string | null): { hour: number | null; weekday: string | null } {
  if (!iso) return { hour: null, weekday: null };
  try {
    const d = new Date(iso);
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(d);
    const dayStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
    }).format(d);
    const hour = Number(hourStr);
    return {
      hour: Number.isFinite(hour) ? hour % 24 : null,
      weekday: dayStr || null,
    };
  } catch {
    return { hour: null, weekday: null };
  }
}

function detectThemes(subject: string, body: string): string[] {
  const hay = `${subject}\n${body}`;
  return THEMES.filter((t) => t.re.test(hay)).map((t) => t.key);
}

function buildFeatures(input: {
  subject: string;
  body: string;
  sentAt: string | null;
  contactName: string | null;
  city: string | null;
  reviewCount: number | null;
  confidence: number | null;
}): MessageFeatures {
  const bodyWords = input.body.trim() ? input.body.trim().split(/\s+/).length : 0;
  const { hour, weekday } = etParts(input.sentAt);
  const first = (input.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const mentionsFirstName =
    first.length >= 2 &&
    new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      `${input.subject} ${input.body}`
    );
  const mentionsCity =
    Boolean(input.city) &&
    new RegExp(
      `\\b${String(input.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    ).test(`${input.subject} ${input.body}`);

  return {
    subjectLength: input.subject.length,
    bodyLength: input.body.length,
    bodyWords,
    hourEt: hour,
    weekdayEt: weekday,
    hasQuestionSubject: /\?/.test(input.subject),
    mentionsFirstName,
    mentionsCity,
    themes: detectThemes(input.subject, input.body),
    reviewBucket: reviewBucket(input.reviewCount),
    confidenceBucket: confidenceBucket(input.confidence),
    bodyLengthBucket: bodyLengthBucket(bodyWords),
  };
}

function whyHints(features: MessageFeatures, match: {
  daysToSignup: number;
  daysToSubscribe: number | null;
  reviewCount: number | null;
  subscriptionStatus: string | null;
  isSubscribed: boolean;
  subscribedAtSource: SubscribedAtSource | null;
}): string[] {
  const hints: string[] = [];
  if (features.mentionsFirstName) hints.push("personalized with contact first name");
  if (features.mentionsCity) hints.push("mentioned their city");
  if (features.hasQuestionSubject) hints.push("subject was a question");
  if (features.themes.includes("trial_or_free")) hints.push("offered free/trial framing");
  if (features.themes.includes("drive_through")) hints.push("led with drive-through angle");
  if (features.themes.includes("time_save")) hints.push("emphasized time savings");
  if (features.bodyLengthBucket.startsWith("short") || features.bodyLengthBucket.startsWith("medium")) {
    hints.push("kept the email relatively concise");
  }
  if (features.hourEt != null && features.hourEt >= 10 && features.hourEt < 15) {
    hints.push("sent inside 10am–3pm ET window");
  }
  if (match.daysToSignup <= 2) hints.push("signed up within 2 days — strong message-market fit");
  if (match.daysToSubscribe != null && match.daysToSubscribe <= 7) {
    hints.push("subscribed within a week of the email — outreach likely helped");
  }
  if (match.reviewCount != null && match.reviewCount <= 20) {
    hints.push("smaller review footprint (often hungrier operators)");
  }
  if (match.isSubscribed) {
    hints.push("became a paying/active subscriber");
    if (match.subscribedAtSource === "community_trial") {
      hints.push("started via community free trial");
    }
  } else if (
    match.subscriptionStatus &&
    match.subscriptionStatus !== "none" &&
    match.subscriptionStatus !== "canceled"
  ) {
    hints.push("subscription status looks active (timing may be unclear)");
  }
  if (hints.length === 0) hints.push("converted — compare against non-converts for patterns");
  return hints;
}

function bump(
  map: Map<string, { sent: number; converted: number }>,
  key: string,
  converted: boolean
) {
  const row = map.get(key) ?? { sent: 0, converted: 0 };
  row.sent += 1;
  if (converted) row.converted += 1;
  map.set(key, row);
}

function toBuckets(
  map: Map<string, { sent: number; converted: number }>,
  limit = 12
): StatBucket[] {
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      sent: v.sent,
      converted: v.converted,
      rate: rate(v.converted, v.sent),
    }))
    .sort((a, b) => b.converted - a.converted || b.rate - a.rate || b.sent - a.sent)
    .slice(0, limit);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function topThemeKeys(
  drafts: Array<{ features: MessageFeatures; converted: boolean }>,
  converted: boolean,
  limit = 5
): string[] {
  const counts = new Map<string, number>();
  for (const d of drafts) {
    if (d.converted !== converted) continue;
    for (const t of d.features.themes) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function buildInsights(report: {
  sentCount: number;
  matchedCount: number;
  subscribedCount: number;
  conversionRate: number;
  subscriptionRate: number;
  byTheme: StatBucket[];
  byThemeSubscribed: StatBucket[];
  byHourEt: StatBucket[];
  byWeekday: StatBucket[];
  byCity: StatBucket[];
  byBodyLength: StatBucket[];
  byReviewBucket: StatBucket[];
  winnersVsLosers: LearningReport["winnersVsLosers"];
  avgDaysToSignup: number | null;
  avgDaysToSubscribe: number | null;
  paidOrActiveConverts: number;
}): string[] {
  const out: string[] = [];
  if (report.sentCount === 0) {
    out.push("No sends in window yet — start sending to generate learning signal.");
    return out;
  }
  out.push(
    `Overall: ${report.matchedCount}/${report.sentCount} email→signup converts (${report.conversionRate}%).`
  );
  if (report.subscribedCount > 0) {
    out.push(
      `${report.subscribedCount} subscribed after outreach (${report.subscriptionRate}% of sends).`
    );
  }
  if (report.avgDaysToSignup != null) {
    out.push(`Average days email→signup: ${report.avgDaysToSignup}.`);
  }
  if (report.avgDaysToSubscribe != null) {
    out.push(`Average days email→subscribe: ${report.avgDaysToSubscribe}.`);
  }
  if (report.paidOrActiveConverts > 0) {
    out.push(
      `${report.paidOrActiveConverts} convert(s) are paid/active — prioritize whatever produced those.`
    );
  }

  const themeSubWin = report.byThemeSubscribed.find(
    (t) => t.converted > 0 && t.sent >= 2
  );
  if (themeSubWin) {
    out.push(
      `Theme "${themeSubWin.key}" correlates with subscriptions (${themeSubWin.converted}/${themeSubWin.sent}).`
    );
  }

  const themeWin = report.byTheme.find((t) => t.converted > 0 && t.sent >= 2);
  if (themeWin) {
    out.push(
      `Theme "${themeWin.key}" is showing signal (${themeWin.converted}/${themeWin.sent}, ${themeWin.rate}%).`
    );
  }
  const cityWin = report.byCity.find((c) => c.converted > 0 && c.sent >= 2);
  if (cityWin) {
    out.push(
      `City "${cityWin.key}" converting (${cityWin.converted}/${cityWin.sent}, ${cityWin.rate}%).`
    );
  }
  const hourWin = report.byHourEt.find((h) => h.converted > 0);
  if (hourWin) {
    out.push(`Sends around ${hourWin.key}:00 ET appear in converts.`);
  }
  const dayWin = report.byWeekday.find((d) => d.converted > 0);
  if (dayWin) {
    out.push(`${dayWin.key} shows up among converting send days.`);
  }
  const lenWin = [...report.byBodyLength].sort((a, b) => b.rate - a.rate)[0];
  if (lenWin && lenWin.converted > 0) {
    out.push(
      `Body length bucket "${lenWin.key}" has the best convert rate so far (${lenWin.rate}%).`
    );
  }
  const revWin = [...report.byReviewBucket].sort((a, b) => b.rate - a.rate)[0];
  if (revWin && revWin.converted > 0 && revWin.key !== "unknown") {
    out.push(
      `Review band "${revWin.key}" converting best (${revWin.converted}/${revWin.sent}).`
    );
  }
  if (
    report.winnersVsLosers.avgBodyWordsConverted != null &&
    report.winnersVsLosers.avgBodyWordsNotConverted != null
  ) {
    const a = report.winnersVsLosers.avgBodyWordsConverted;
    const b = report.winnersVsLosers.avgBodyWordsNotConverted;
    if (Math.abs(a - b) >= 15) {
      out.push(
        a < b
          ? `Converts are shorter on average (${a} vs ${b} words) — try tighter copy.`
          : `Converts are longer on average (${a} vs ${b} words) — detail may be helping.`
      );
    }
  }
  if (report.matchedCount === 0) {
    out.push(
      "No hard email matches yet. Use soft name matches + recent signups as weak signals, and remember experiments."
    );
  }
  return out;
}

const APP_CONTEXT = {
  whatWeMatch:
    "Hard: sent nexus_drafts.to_email → profiles.email with signup after sent_at. Subscription: active/trialing after email using Stripe webhook events (nexus_actions), community_trials.claimed_at, or status when timing unknown. Soft: hoa_name ≈ company name. Learning slices: subject, city/state, hour/weekday ET, body length, themes, review bands, confidence, personalization — plus subscription-themed slices.",
  tables: [
    "nexus_drafts (subject, body, confidence, sent_at, to_email)",
    "nexus_companies (city, state, metadata.userRatingCount, stage)",
    "nexus_contacts (name, role, email)",
    "nexus_actions (outreach.email_sent, outreach.converted, outreach.subscribed, subscription.*)",
    "nexus_suppressions (do-not-contact)",
    "profiles (signups: email, hoa_name, plan, subscription_status, stripe_customer_id, created_at)",
    "community_trials (claimed_at, claimed_by — free trial timing)",
  ],
  howToLearn:
    "Compare converts vs non-converts on themes/timing/length/reviews. Track sent→signup→subscribe lag. Remember winning hypotheses as kind=trial. Re-check with learn after more sends.",
};

/**
 * Full learning dossier for Nova.
 */
export async function loadLearningReport(options?: {
  sinceDays?: number;
  limit?: number;
  syncWins?: boolean;
}): Promise<LearningReport> {
  const sinceDays = Math.min(365, Math.max(7, options?.sinceDays ?? 90));
  const limit = Math.min(40, Math.max(5, options?.limit ?? 15));
  const syncWins = options?.syncWins ?? true;

  const empty: LearningReport = {
    sinceDays,
    sentCount: 0,
    matchedCount: 0,
    conversionRate: 0,
    paidOrActiveConverts: 0,
    subscribedCount: 0,
    subscriptionRate: 0,
    avgDaysToSignup: null,
    medianDaysToSignup: null,
    avgDaysToSubscribe: null,
    medianDaysToSubscribe: null,
    matches: [],
    nonConvertedSample: [],
    bySubject: [],
    byCity: [],
    byState: [],
    byHourEt: [],
    byWeekday: [],
    byTheme: [],
    byReviewBucket: [],
    byBodyLength: [],
    byConfidence: [],
    byThemeSubscribed: [],
    bySubjectSubscribed: [],
    winnersVsLosers: {
      avgBodyWordsConverted: null,
      avgBodyWordsNotConverted: null,
      avgReviewsConverted: null,
      avgReviewsNotConverted: null,
      topThemesConverted: [],
      topThemesNotConverted: [],
      bestHoursEt: [],
      bestWeekdays: [],
    },
    funnel: {
      activeCompanies: 0,
      contacts: 0,
      pendingDrafts: 0,
      approvedDrafts: 0,
      sentDrafts: 0,
      rejectedDrafts: 0,
      converted: 0,
      subscribed: 0,
      wonCompanies: 0,
      suppressions: 0,
    },
    subscriptionFunnel: {
      emailed: 0,
      signedUp: 0,
      subscribed: 0,
      signupRate: 0,
      subscribeRate: 0,
    },
    rejections: [],
    softNameMatches: [],
    recentSignups: [],
    recentSubscribers: [],
    recentTrials: [],
    recentActions: [],
    insights: ["Database unavailable or empty."],
    appContext: APP_CONTEXT,
  };

  const db = getNexusDb();
  if (!db) return empty;

  const sinceIso = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    draftsRes,
    profilesRes,
    funnelCounts,
    rejectedRes,
    trialsRes,
    actionsRes,
    suppressionsRes,
    wonRes,
  ] = await Promise.all([
    db
      .from("nexus_drafts")
      .select(
        "id, to_email, subject, body, confidence, sent_at, company_id, contact_id, company:nexus_companies(id, name, city, state, stage, metadata), contact:nexus_contacts(id, name, role)"
      )
      .eq("status", "sent")
      .not("sent_at", "is", null)
      .gte("sent_at", sinceIso)
      .order("sent_at", { ascending: false })
      .limit(500),
    db
      .from("profiles")
      .select(
        "id, email, hoa_name, created_at, plan, subscription_status, stripe_customer_id, community_key"
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500),
    Promise.all([
      db
        .from("nexus_companies")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      db.from("nexus_contacts").select("*", { count: "exact", head: true }),
      db
        .from("nexus_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval"),
      db
        .from("nexus_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),
      db
        .from("nexus_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent"),
      db
        .from("nexus_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]),
    db
      .from("nexus_drafts")
      .select("rejection_reason")
      .eq("status", "rejected")
      .not("rejection_reason", "is", null)
      .limit(200),
    db
      .from("community_trials")
      .select("hoa_name, community_key, claimed_at")
      .order("claimed_at", { ascending: false })
      .limit(15),
    db
      .from("nexus_actions")
      .select("action, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(25),
    db.from("nexus_suppressions").select("*", { count: "exact", head: true }),
    db
      .from("nexus_companies")
      .select("*", { count: "exact", head: true })
      .eq("stage", "won"),
  ]);

  if (draftsRes.error) {
    console.error("learn drafts:", draftsRes.error.message);
    return {
      ...empty,
      insights: [draftsRes.error.message],
      appContext: { ...APP_CONTEXT, whatWeMatch: draftsRes.error.message },
    };
  }

  const drafts = (draftsRes.data ?? []) as SentDraftRow[];
  let profiles = (profilesRes.data ?? []) as ProfileRow[];
  if (profilesRes.error) {
    console.error("learn profiles:", profilesRes.error.message);
  }

  const emailedSet = new Set<string>();
  for (const d of drafts) {
    const e = normEmail(d.to_email);
    if (e) emailedSet.add(e);
  }

  if (emailedSet.size > 0) {
    const emailedList = [...emailedSet];
    const { data: emailedProfiles, error: emailedErr } = await db
      .from("profiles")
      .select(
        "id, email, hoa_name, created_at, plan, subscription_status, stripe_customer_id, community_key"
      )
      .in("email", emailedList.slice(0, 200))
      .limit(300);
    if (emailedErr) {
      console.error("learn emailed profiles:", emailedErr.message);
    } else {
      const byId = new Map(profiles.map((p) => [p.id, p]));
      for (const row of (emailedProfiles ?? []) as ProfileRow[]) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
      profiles = [...byId.values()];
    }
  }

  const profileIds = profiles.map((p) => p.id);
  const [subscriptionEventsByProfile, trialClaimsRes] = await Promise.all([
    loadSubscriptionEvents(db, sinceIso, profileIds.length ? profileIds : undefined),
    profileIds.length
      ? db
          .from("community_trials")
          .select("claimed_by, claimed_at, hoa_name, community_key")
          .in("claimed_by", profileIds.slice(0, 200))
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const trialClaimByProfile = new Map<string, TrialClaimRow>();
  for (const row of (trialClaimsRes.data ?? []) as TrialClaimRow[]) {
    if (!row.claimed_by) continue;
    const existing = trialClaimByProfile.get(row.claimed_by);
    if (
      !existing ||
      new Date(row.claimed_at).getTime() <
        new Date(existing.claimed_at).getTime()
    ) {
      trialClaimByProfile.set(row.claimed_by, row);
    }
  }

  function subscriptionForProfile(profile: ProfileRow) {
    const trial = trialClaimByProfile.get(profile.id);
    return resolveSubscriptionTiming({
      subscriptionStatus: profile.subscription_status,
      stripeCustomerId: profile.stripe_customer_id,
      stripeEvents: subscriptionEventsByProfile.get(profile.id) ?? [],
      trialClaimedAt: trial?.claimed_at ?? null,
    });
  }

  type Annotated = {
    draft: SentDraftRow;
    company: CompanyJoin | null;
    contact: ContactJoin | null;
    reviewCount: number | null;
    features: MessageFeatures;
    converted: boolean;
    subscribed: boolean;
  };

  const annotated: Annotated[] = drafts.map((draft) => {
    const company = unwrap(draft.company);
    const contact = unwrap(draft.contact);
    const reviewCount = reviewCountOf(company?.metadata ?? null);
    const subject = draft.subject ?? "";
    const body = draft.body ?? "";
    const features = buildFeatures({
      subject,
      body,
      sentAt: draft.sent_at,
      contactName: contact?.name ?? null,
      city: company?.city ?? null,
      reviewCount,
      confidence: draft.confidence,
    });
    return {
      draft,
      company,
      contact,
      reviewCount,
      features,
      converted: false,
      subscribed: false,
    };
  });

  const byEmail = new Map<string, Annotated[]>();
  for (const row of annotated) {
    const email = normEmail(row.draft.to_email);
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(row);
    byEmail.set(email, list);
  }
  for (const list of byEmail.values()) {
    list.sort(
      (a, b) =>
        new Date(b.draft.sent_at ?? 0).getTime() -
        new Date(a.draft.sent_at ?? 0).getTime()
    );
  }

  const matches: ConversionMatch[] = [];
  const matchedDraftIds = new Set<string>();
  const matchedProfileIds = new Set<string>();
  const subscribedDraftIds = new Set<string>();
  const outreachByProfile = new Map<
    string,
    { draftId: string; sentAt: string; subject: string }
  >();

  for (const profile of profiles) {
    const email = normEmail(profile.email);
    if (!email) continue;
    const candidates = byEmail.get(email);
    if (!candidates?.length) continue;

    const sub = subscriptionForProfile(profile);
    const signupMs = new Date(profile.created_at).getTime();

    const priorSignup = candidates.find((c) => {
      if (!c.draft.sent_at) return false;
      return new Date(c.draft.sent_at).getTime() <= signupMs;
    });

    const priorSubscribe =
      sub.subscribedAt != null
        ? candidates.find((c) => {
            if (!c.draft.sent_at) return false;
            return (
              new Date(c.draft.sent_at).getTime() <=
              new Date(sub.subscribedAt!).getTime()
            );
          })
        : null;

    const prior = priorSignup ?? priorSubscribe;
    if (!prior?.draft.sent_at) continue;

    const signedUpAfterEmail =
      Boolean(priorSignup) &&
      new Date(prior.draft.sent_at).getTime() <= signupMs;
    const subscribedAfterEmail =
      sub.isSubscribed &&
      sub.subscribedAt != null &&
      new Date(prior.draft.sent_at).getTime() <=
        new Date(sub.subscribedAt).getTime();

    if (!signedUpAfterEmail && !subscribedAfterEmail) continue;

    prior.converted = signedUpAfterEmail || subscribedAfterEmail;
    if (signedUpAfterEmail) matchedDraftIds.add(prior.draft.id);
    if (subscribedAfterEmail) {
      subscribedDraftIds.add(prior.draft.id);
      prior.subscribed = true;
    }
    matchedProfileIds.add(profile.id);

    outreachByProfile.set(profile.id, {
      draftId: prior.draft.id,
      sentAt: prior.draft.sent_at,
      subject: prior.draft.subject ?? "(no subject)",
    });

    const days = signedUpAfterEmail
      ? daysBetween(prior.draft.sent_at, profile.created_at)
      : 0;
    const daysToSubscribe =
      sub.subscribedAt && subscribedAfterEmail
        ? daysBetween(prior.draft.sent_at, sub.subscribedAt)
        : null;

    let conversionPath: ConversionMatch["conversionPath"] = "signup_only";
    if (signedUpAfterEmail && sub.isSubscribed) {
      conversionPath = "signup_and_subscribed";
    } else if (!signedUpAfterEmail && subscribedAfterEmail) {
      conversionPath = "subscribed_after_outreach";
    }

    const features = prior.features;
    matches.push({
      draftId: prior.draft.id,
      email,
      subject: prior.draft.subject ?? "(no subject)",
      bodyExcerpt: excerpt(prior.draft.body),
      companyId: prior.draft.company_id,
      companyName: prior.company?.name ?? "Unknown",
      city: prior.company?.city ?? null,
      state: prior.company?.state ?? null,
      reviewCount: prior.reviewCount,
      contactName: prior.contact?.name ?? null,
      contactRole: prior.contact?.role ?? null,
      draftConfidence: prior.draft.confidence,
      sentAt: prior.draft.sent_at,
      signedUpAt: profile.created_at,
      profileId: profile.id,
      hoaName: profile.hoa_name,
      plan: profile.plan,
      subscriptionStatus: profile.subscription_status,
      daysToSignup: days,
      isSubscribed: sub.isSubscribed,
      subscribedAt: sub.subscribedAt,
      subscribedAtSource: sub.subscribedAtSource,
      daysToSubscribe,
      conversionPath,
      features,
      whyHints: whyHints(features, {
        daysToSignup: days,
        daysToSubscribe,
        reviewCount: prior.reviewCount,
        subscriptionStatus: profile.subscription_status,
        isSubscribed: sub.isSubscribed,
        subscribedAtSource: sub.subscribedAtSource,
      }),
    });
  }

  matches.sort(
    (a, b) =>
      new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime()
  );

  const emailedCompanies = annotated
    .map((a) =>
      a.company ? { id: a.company.id, name: a.company.name } : null
    )
    .filter((c): c is { id: string; name: string } => Boolean(c));

  const softNameMatches: SoftNameMatch[] = [];
  for (const profile of profiles) {
    if (matchedProfileIds.has(profile.id)) continue;
    if (!profile.hoa_name) continue;
    const hit = emailedCompanies.find((c) =>
      namesLikelyMatch(profile.hoa_name!, c.name)
    );
    if (!hit) continue;
    const sub = subscriptionForProfile(profile);
    softNameMatches.push({
      profileId: profile.id,
      hoaName: profile.hoa_name,
      companyId: hit.id,
      companyName: hit.name,
      signedUpAt: profile.created_at,
      isSubscribed: sub.isSubscribed,
      subscribedAt: sub.subscribedAt,
      plan: profile.plan,
      reason: "hoa_name ≈ company name (email did not match a sent draft)",
    });
    if (softNameMatches.length >= 12) break;
  }

  const subjectStats = new Map<string, { sent: number; converted: number }>();
  const subjectSubStats = new Map<string, { sent: number; converted: number }>();
  const cityStats = new Map<string, { sent: number; converted: number }>();
  const stateStats = new Map<string, { sent: number; converted: number }>();
  const hourStats = new Map<string, { sent: number; converted: number }>();
  const weekdayStats = new Map<string, { sent: number; converted: number }>();
  const themeStats = new Map<string, { sent: number; converted: number }>();
  const themeSubStats = new Map<string, { sent: number; converted: number }>();
  const reviewStats = new Map<string, { sent: number; converted: number }>();
  const bodyStats = new Map<string, { sent: number; converted: number }>();
  const confStats = new Map<string, { sent: number; converted: number }>();

  for (const row of annotated) {
    const converted = matchedDraftIds.has(row.draft.id);
    const subscribed = subscribedDraftIds.has(row.draft.id);
    const subjectKey =
      (row.draft.subject ?? "(no subject)").trim() || "(no subject)";
    bump(subjectStats, subjectKey, converted);
    bump(subjectSubStats, subjectKey, subscribed);
    bump(cityStats, (row.company?.city ?? "unknown").trim() || "unknown", converted);
    bump(stateStats, (row.company?.state ?? "unknown").trim() || "unknown", converted);
    bump(
      hourStats,
      row.features.hourEt != null ? String(row.features.hourEt) : "unknown",
      converted
    );
    bump(weekdayStats, row.features.weekdayEt ?? "unknown", converted);
    bump(reviewStats, row.features.reviewBucket, converted);
    bump(bodyStats, row.features.bodyLengthBucket, converted);
    bump(confStats, row.features.confidenceBucket, converted);
    if (row.features.themes.length === 0) {
      bump(themeStats, "no_theme", converted);
      bump(themeSubStats, "no_theme", subscribed);
    } else {
      for (const theme of row.features.themes) {
        bump(themeStats, theme, converted);
        bump(themeSubStats, theme, subscribed);
      }
    }
  }

  const bySubject = toBuckets(subjectStats, 10);
  const bySubjectSubscribed = toBuckets(subjectSubStats, 10);
  const byCity = toBuckets(cityStats, 10);
  const byState = toBuckets(stateStats, 10);
  const byHourEt = toBuckets(hourStats, 24).sort((a, b) => {
    const ah = Number(a.key);
    const bh = Number(b.key);
    if (Number.isFinite(ah) && Number.isFinite(bh)) return ah - bh;
    return a.key.localeCompare(b.key);
  });
  const byWeekday = WEEKDAYS.map((day) => {
    const v = weekdayStats.get(day) ?? { sent: 0, converted: 0 };
    return { key: day, sent: v.sent, converted: v.converted, rate: rate(v.converted, v.sent) };
  }).filter((d) => d.sent > 0);
  const byTheme = toBuckets(themeStats, 12);
  const byThemeSubscribed = toBuckets(themeSubStats, 12);
  const byReviewBucket = toBuckets(reviewStats, 8);
  const byBodyLength = toBuckets(bodyStats, 8);
  const byConfidence = toBuckets(confStats, 8);

  const convertedRows = annotated.filter((a) => matchedDraftIds.has(a.draft.id));
  const lostRows = annotated.filter((a) => !matchedDraftIds.has(a.draft.id));

  const winnersVsLosers: LearningReport["winnersVsLosers"] = {
    avgBodyWordsConverted: avg(convertedRows.map((r) => r.features.bodyWords)),
    avgBodyWordsNotConverted: avg(lostRows.map((r) => r.features.bodyWords)),
    avgReviewsConverted: avg(
      convertedRows
        .map((r) => r.reviewCount)
        .filter((n): n is number => n != null)
    ),
    avgReviewsNotConverted: avg(
      lostRows.map((r) => r.reviewCount).filter((n): n is number => n != null)
    ),
    topThemesConverted: topThemeKeys(annotated, true),
    topThemesNotConverted: topThemeKeys(annotated, false),
    bestHoursEt: byHourEt
      .filter((h) => h.converted > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map((h) => `${h.key}:00 ET (${h.converted}/${h.sent})`),
    bestWeekdays: byWeekday
      .filter((d) => d.converted > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map((d) => `${d.key} (${d.converted}/${d.sent})`),
  };

  const daysList = matches.map((m) => m.daysToSignup).filter((d) => d > 0);
  const subscribeDaysList = matches
    .map((m) => m.daysToSubscribe)
    .filter((d): d is number => d != null);
  const avgDaysToSignup = avg(daysList);
  const medianDaysToSignup = median(daysList);
  const avgDaysToSubscribe = avg(subscribeDaysList);
  const medianDaysToSubscribe = median(subscribeDaysList);
  const subscribedCount = matches.filter((m) => m.isSubscribed).length;
  const paidOrActiveConverts = subscribedCount;

  const signupMatchedCount = matches.filter(
    (m) => m.conversionPath !== "subscribed_after_outreach"
  ).length;

  const subscriptionFunnel = {
    emailed: annotated.length,
    signedUp: signupMatchedCount,
    subscribed: subscribedCount,
    signupRate: rate(signupMatchedCount, annotated.length),
    subscribeRate: rate(subscribedCount, annotated.length),
  };

  const [
    activeCompanies,
    contacts,
    pendingDrafts,
    approvedDrafts,
    sentDrafts,
    rejectedDrafts,
  ] = funnelCounts.map((r) => r.count ?? 0);

  const rejectionCounts = new Map<string, number>();
  for (const row of rejectedRes.data ?? []) {
    const reason =
      String(
        (row as { rejection_reason?: string }).rejection_reason ?? "unspecified"
      ).trim() || "unspecified";
    rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1);
  }
  const rejections = [...rejectionCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const nonConvertedSample = lostRows.slice(0, 8).map((row) => ({
    draftId: row.draft.id,
    email: normEmail(row.draft.to_email),
    subject: row.draft.subject ?? "(no subject)",
    bodyExcerpt: excerpt(row.draft.body),
    companyName: row.company?.name ?? "Unknown",
    city: row.company?.city ?? null,
    reviewCount: row.reviewCount,
    sentAt: row.draft.sent_at ?? "",
    features: row.features,
  }));

  const insights = buildInsights({
    sentCount: annotated.length,
    matchedCount: matches.length,
    subscribedCount,
    conversionRate: rate(matches.length, annotated.length),
    subscriptionRate: rate(subscribedCount, annotated.length),
    byTheme,
    byThemeSubscribed,
    byHourEt,
    byWeekday,
    byCity,
    byBodyLength,
    byReviewBucket,
    winnersVsLosers,
    avgDaysToSignup,
    avgDaysToSubscribe,
    paidOrActiveConverts,
  });

  const recentSubscribers = profiles
    .filter((p) => isActiveSubscriptionStatus(p.subscription_status))
    .map((p) => {
      const sub = subscriptionForProfile(p);
      const outreach = outreachByProfile.get(p.id);
      return {
        email: p.email,
        hoaName: p.hoa_name,
        plan: p.plan,
        subscriptionStatus: p.subscription_status,
        subscribedAt: sub.subscribedAt,
        subscribedAtSource: sub.subscribedAtSource,
        matchedOutreach: matchedProfileIds.has(p.id),
        outreachSubject: outreach?.subject ?? null,
        daysFromEmailToSubscribe:
          outreach && sub.subscribedAt
            ? daysBetween(outreach.sentAt, sub.subscribedAt)
            : null,
      };
    })
    .sort((a, b) => {
      const ta = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
      const tb = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 15);

  if (syncWins && matches.length > 0) {
    await syncConversionWins(matches).catch((err) => {
      console.error("syncConversionWins:", err);
    });
  }

  return {
    sinceDays,
    sentCount: annotated.length,
    matchedCount: matches.length,
    conversionRate: rate(matches.length, annotated.length),
    paidOrActiveConverts,
    subscribedCount,
    subscriptionRate: rate(subscribedCount, annotated.length),
    avgDaysToSignup,
    medianDaysToSignup,
    avgDaysToSubscribe,
    medianDaysToSubscribe,
    matches: matches.slice(0, limit),
    nonConvertedSample,
    bySubject,
    bySubjectSubscribed,
    byCity,
    byState,
    byHourEt,
    byWeekday,
    byTheme,
    byThemeSubscribed,
    byReviewBucket,
    byBodyLength,
    byConfidence,
    winnersVsLosers,
    funnel: {
      activeCompanies,
      contacts,
      pendingDrafts,
      approvedDrafts,
      sentDrafts,
      rejectedDrafts,
      converted: matches.length,
      subscribed: subscribedCount,
      wonCompanies: wonRes.count ?? 0,
      suppressions: suppressionsRes.count ?? 0,
    },
    subscriptionFunnel,
    rejections,
    softNameMatches,
    recentSignups: profiles.slice(0, 15).map((p) => {
      const sub = subscriptionForProfile(p);
      return {
        email: p.email,
        hoaName: p.hoa_name,
        createdAt: p.created_at,
        plan: p.plan,
        subscriptionStatus: p.subscription_status,
        matchedOutreach: matchedProfileIds.has(p.id),
        isSubscribed: sub.isSubscribed,
        subscribedAt: sub.subscribedAt,
      };
    }),
    recentSubscribers,
    recentTrials: (trialsRes.data ?? []).map((t) => ({
      hoaName: String((t as { hoa_name?: string }).hoa_name ?? ""),
      communityKey: String((t as { community_key?: string }).community_key ?? ""),
      claimedAt: String((t as { claimed_at?: string }).claimed_at ?? ""),
    })),
    recentActions: (actionsRes.data ?? []).map((a) => ({
      action: String((a as { action?: string }).action ?? ""),
      createdAt: String((a as { created_at?: string }).created_at ?? ""),
      metadata:
        ((a as { metadata?: Record<string, unknown> }).metadata as Record<
          string,
          unknown
        >) ?? {},
    })),
    insights,
    appContext: APP_CONTEXT,
  };
}

/** Back-compat name used by tools. */
export async function loadConversionReport(options?: {
  sinceDays?: number;
  limit?: number;
  syncWins?: boolean;
}): Promise<LearningReport> {
  return loadLearningReport(options);
}

/** Lightweight counts for status cockpit. */
export async function loadConversionSummary(sinceDays = 90): Promise<{
  sinceDays: number;
  sentCount: number;
  matchedCount: number;
  conversionRate: number;
  subscribedCount: number;
  subscriptionRate: number;
  recentSignupCount: number;
}> {
  const report = await loadLearningReport({
    sinceDays,
    limit: 1,
    syncWins: false,
  });

  return {
    sinceDays: report.sinceDays,
    sentCount: report.sentCount,
    matchedCount: report.matchedCount,
    conversionRate: report.conversionRate,
    subscribedCount: report.subscribedCount,
    subscriptionRate: report.subscriptionRate,
    recentSignupCount: report.recentSignups.length,
  };
}

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

    const { data: existing } = await db
      .from("nexus_actions")
      .select("id")
      .eq("action", "outreach.converted")
      .eq("entity_id", match.draftId)
      .limit(1);

    if (!existing?.length) {
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
          themes: match.features.themes,
          whyHints: match.whyHints,
          isSubscribed: match.isSubscribed,
          subscribedAt: match.subscribedAt,
          daysToSubscribe: match.daysToSubscribe,
          conversionPath: match.conversionPath,
        },
      });
    }

    if (!match.isSubscribed) continue;

    const { data: subExisting } = await db
      .from("nexus_actions")
      .select("id")
      .eq("action", "outreach.subscribed")
      .eq("entity_id", match.draftId)
      .limit(1);

    if (subExisting?.length) continue;

    await db.from("nexus_actions").insert({
      actor: "nova",
      action: "outreach.subscribed",
      entity_type: "draft",
      entity_id: match.draftId,
      metadata: {
        email: match.email,
        profileId: match.profileId,
        companyId: match.companyId,
        sentAt: match.sentAt,
        signedUpAt: match.signedUpAt,
        subscribedAt: match.subscribedAt,
        subscribedAtSource: match.subscribedAtSource,
        daysToSignup: match.daysToSignup,
        daysToSubscribe: match.daysToSubscribe,
        plan: match.plan,
        subject: match.subject,
        themes: match.features.themes,
        conversionPath: match.conversionPath,
      },
    });
  }
}
