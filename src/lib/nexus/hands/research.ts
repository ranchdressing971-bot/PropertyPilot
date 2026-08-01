import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob, logAction } from "../jobs";
import type {
  HandResult,
  NexusCompany,
  OutreachDraftPayload,
  ResearchCompanyPayload,
} from "../types";

/**
 * Research Hand — visits a company website and extracts publicly published
 * email addresses, recording the exact page each one came from.
 *
 * Constraints this operates under, all of which are load-bearing:
 *  - Other people's servers. Every fetch is timed out, the page budget is
 *    small, and requests are sequential with a pause between them.
 *  - robots.txt is honored for our own user-agent and `*`.
 *  - Only publicly posted addresses are collected. Nothing is guessed or
 *    pattern-generated, because a bounced guess damages sending reputation.
 */

const USER_AGENT =
  "RideByBot/1.0 (+https://rideby-ai.vercel.app; contact via website)";

// Sized against the runner's 30s reserve for this job type: one robots.txt
// fetch plus MAX_PAGES page fetches must fit, worst case, with room to spare.
const FETCH_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_PAGES = 3;
const POLITENESS_DELAY_MS = 400;
const MAX_HTML_BYTES = 1_500_000;

/** Paths worth checking beyond the homepage, best first. */
const CANDIDATE_HINTS = [
  "contact",
  "contact-us",
  "about",
  "about-us",
  "team",
  "our-team",
  "staff",
  "leadership",
  "management",
  "people",
  "who-we-are",
];

/**
 * Addresses that are real but never a human at the company: analytics vendors,
 * site builders, stock photo libraries, and placeholder text.
 */
const JUNK_DOMAINS = [
  "example.com",
  "example.org",
  "domain.com",
  "yourdomain.com",
  "email.com",
  "sentry.io",
  "sentry-next.wixpress.com",
  "wixpress.com",
  "wix.com",
  "squarespace.com",
  "godaddy.com",
  "shutterstock.com",
  "unsplash.com",
  "w3.org",
  "schema.org",
  "googlemail.com",
  "cloudflare.com",
];

const JUNK_LOCAL_PARTS = ["noreply", "no-reply", "donotreply", "do-not-reply"];

/** Mailboxes that reach a desk but not a named person. */
const ROLE_LOCAL_PARTS = [
  "info",
  "contact",
  "hello",
  "sales",
  "support",
  "admin",
  "office",
  "inquiries",
  "enquiries",
  "help",
  "service",
  "customerservice",
  "frontdesk",
  "general",
];

// Deliberately conservative: a trailing dot or a file extension means we
// probably grabbed a filename, not an address.
const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IMAGE_SUFFIXES = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".css",
  ".js",
  ".woff",
  ".woff2",
];

interface FetchedPage {
  url: string;
  html: string;
}

interface FoundEmail {
  email: string;
  sourceUrl: string;
  name: string | null;
  role: string | null;
  confidence: number;
}

function normalizeSiteUrl(website: string): URL | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("html") && !contentType.includes("text")) {
      return null;
    }

    const text = await response.text();
    return text.slice(0, MAX_HTML_BYTES);
  } catch {
    // Timeouts, DNS failures, TLS errors, and aborts are all "site unavailable"
    // as far as the crawl is concerned.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Minimal robots.txt evaluation: collects Disallow rules from the `*` group and
 * any group naming our agent, then prefix-matches. Deliberately errs toward not
 * fetching when a rule is ambiguous.
 */
export function parseDisallowedPaths(robotsTxt: string): string[] {
  const disallowed: string[] = [];
  let groupApplies = false;

  for (const rawLine of robotsTxt.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      groupApplies = agent === "*" || agent.includes("ridebybot");
      continue;
    }
    if (key === "disallow" && groupApplies && value) {
      disallowed.push(value);
    }
  }

  return disallowed;
}

function isAllowed(pathname: string, disallowed: string[]): boolean {
  return !disallowed.some((rule) => {
    if (rule === "/") return true;
    return pathname.startsWith(rule);
  });
}

/** Pull same-host links whose href or anchor text suggests contact info. */
function findCandidateLinks(page: FetchedPage, origin: string): string[] {
  const found = new Map<string, number>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(page.html)) !== null) {
    const [, href, innerHtml] = match;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, page.url);
    } catch {
      continue;
    }
    if (resolved.origin !== origin) continue;

    resolved.hash = "";
    const haystack = `${resolved.pathname} ${innerHtml.replace(/<[^>]+>/g, " ")}`
      .toLowerCase();

    const hintIndex = CANDIDATE_HINTS.findIndex((hint) => haystack.includes(hint));
    if (hintIndex === -1) continue;

    const key = resolved.toString();
    const existing = found.get(key);
    if (existing === undefined || hintIndex < existing) {
      found.set(key, hintIndex);
    }
  }

  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([url]) => url);
}

function looksLikeFilename(email: string): boolean {
  const lower = email.toLowerCase();
  return IMAGE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/** "jane.doe@" → "Jane Doe". Returns null when the local part isn't a name. */
function deriveName(localPart: string): string | null {
  const cleaned = localPart.replace(/\d+/g, "");
  const parts = cleaned.split(/[._-]+/).filter((p) => p.length > 1);
  if (parts.length < 2) return null;
  if (parts.some((p) => !/^[a-z]+$/i.test(p))) return null;
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Confidence heuristic. A named mailbox on the company's own domain, published
 * on a contact page, is the strongest signal available without sending mail.
 */
function scoreEmail(
  email: string,
  siteHost: string,
  sourceUrl: string,
  fromMailto: boolean
): number {
  const [localPart, domain] = email.split("@");
  let score = 40;

  const siteRoot = siteHost.replace(/^www\./, "");
  if (domain.replace(/^www\./, "") === siteRoot) score += 25;

  if (fromMailto) score += 10;

  const isRole = ROLE_LOCAL_PARTS.includes(localPart.toLowerCase());
  if (isRole) {
    score += 5;
  } else if (deriveName(localPart)) {
    score += 20;
  }

  if (/contact|about|team|staff|leadership/i.test(sourceUrl)) score += 5;

  return Math.max(0, Math.min(100, score));
}

function extractEmails(page: FetchedPage, siteHost: string): FoundEmail[] {
  const results = new Map<string, FoundEmail>();

  const consider = (raw: string, fromMailto: boolean) => {
    const email = raw.trim().toLowerCase().replace(/[.,;:)\]]+$/, "");
    if (!email.includes("@")) return;
    if (looksLikeFilename(email)) return;

    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return;
    if (JUNK_LOCAL_PARTS.some((junk) => localPart.includes(junk))) return;
    if (JUNK_DOMAINS.some((junk) => domain === junk || domain.endsWith(`.${junk}`))) {
      return;
    }
    // Hashed asset names and tracking pixels routinely look like addresses.
    if (localPart.length > 40 || /^[0-9a-f]{16,}$/.test(localPart)) return;

    const existing = results.get(email);
    const confidence = scoreEmail(email, siteHost, page.url, fromMailto);
    if (existing && existing.confidence >= confidence) return;

    results.set(email, {
      email,
      sourceUrl: page.url,
      name: deriveName(localPart),
      role: ROLE_LOCAL_PARTS.includes(localPart) ? "general inbox" : null,
      confidence,
    });
  };

  const mailtoPattern = /mailto:([^"'?>\s]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = mailtoPattern.exec(page.html)) !== null) {
    consider(decodeURIComponent(match[1]), true);
  }

  // Strip scripts and styles before the plaintext sweep: inline JS is the main
  // source of false positives.
  const visible = page.html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  for (const candidate of visible.match(EMAIL_PATTERN) ?? []) {
    consider(candidate, false);
  }

  return [...results.values()];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runResearchCompany(
  payload: ResearchCompanyPayload,
  db: SupabaseClient
): Promise<HandResult> {
  const companyId = payload.companyId;
  if (!companyId) throw new Error("research.company requires a companyId");

  const { data: companyRow, error: loadError } = await db
    .from("nexus_companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (loadError) throw new Error(`Failed to load company: ${loadError.message}`);
  if (!companyRow) throw new Error(`Company ${companyId} not found`);

  const company = companyRow as NexusCompany;

  const markCompany = async (fields: Record<string, unknown>) => {
    await db
      .from("nexus_companies")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", companyId);
  };

  if (!company.website) {
    await markCompany({
      research_status: "skipped",
      research_error: "No website on record",
      researched_at: new Date().toISOString(),
    });
    return { summary: "skipped — no website", metadata: { companyId } };
  }

  const base = normalizeSiteUrl(company.website);
  if (!base) {
    await markCompany({
      research_status: "skipped",
      research_error: `Unparseable website: ${company.website}`,
      researched_at: new Date().toISOString(),
    });
    return { summary: "skipped — bad website URL", metadata: { companyId } };
  }

  await markCompany({ research_status: "running", research_error: null });

  const maxPages = Math.min(Math.max(payload.maxPages ?? DEFAULT_MAX_PAGES, 1), 5);
  const disallowed = parseDisallowedPaths(
    (await fetchText(new URL("/robots.txt", base.origin).toString())) ?? ""
  );

  const visited = new Set<string>();
  const pages: FetchedPage[] = [];

  const visit = async (url: string): Promise<FetchedPage | null> => {
    if (visited.has(url) || pages.length >= maxPages) return null;
    visited.add(url);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!isAllowed(parsed.pathname, disallowed)) return null;

    if (pages.length > 0) await sleep(POLITENESS_DELAY_MS);

    const html = await fetchText(url);
    if (!html) return null;

    const page = { url, html };
    pages.push(page);
    return page;
  };

  const homepage = await visit(base.toString());
  if (!homepage) {
    const message = "Site unreachable, blocked by robots.txt, or returned no HTML";
    await markCompany({
      research_status: "failed",
      research_error: message,
      researched_at: new Date().toISOString(),
      research_pages: 0,
    });
    return { summary: `failed — ${message}`, metadata: { companyId } };
  }

  for (const link of findCandidateLinks(homepage, base.origin)) {
    if (pages.length >= maxPages) break;
    await visit(link);
  }

  // Best score per address across every page we saw.
  const byEmail = new Map<string, FoundEmail>();
  for (const page of pages) {
    for (const found of extractEmails(page, base.host)) {
      const existing = byEmail.get(found.email);
      if (!existing || found.confidence > existing.confidence) {
        byEmail.set(found.email, found);
      }
    }
  }

  const candidates = [...byEmail.values()].sort(
    (a, b) => b.confidence - a.confidence
  );

  let stored = 0;
  for (const candidate of candidates) {
    const { data: inserted, error } = await db
      .from("nexus_contacts")
      .upsert(
        {
          company_id: companyId,
          email: candidate.email,
          name: candidate.name,
          role: candidate.role,
          source_url: candidate.sourceUrl,
          confidence: candidate.confidence,
        },
        { onConflict: "company_id,email" }
      )
      .select("id")
      .single();

    if (error) {
      console.error(`[nexus] contact upsert failed for ${candidate.email}:`, error.message);
      continue;
    }

    stored += 1;
    await logAction(
      {
        action: "research.contact_found",
        entityType: "contact",
        entityId: inserted.id,
        confidence: candidate.confidence,
        metadata: {
          company: company.name,
          email: candidate.email,
          sourceUrl: candidate.sourceUrl,
        },
      },
      db
    );
  }

  await markCompany({
    research_status: "done",
    research_error: stored === 0 ? "No public emails published" : null,
    researched_at: new Date().toISOString(),
    research_pages: pages.length,
    // Only advance the pipeline when there's actually someone to write to.
    ...(stored > 0 && company.stage === "new" ? { stage: "ready" } : {}),
  });

  // Auto pipeline: draft a cold email for the best contact, then AI-review it.
  if (stored > 0) {
    await enqueueJob(
      {
        type: "outreach.draft",
        payload: { companyId } satisfies OutreachDraftPayload,
        dedupeKey: `outreach.draft:${companyId}`,
        delaySeconds: 3,
      },
      db
    );
  }

  return {
    summary: `${stored} contact${stored === 1 ? "" : "s"} from ${pages.length} page${
      pages.length === 1 ? "" : "s"
    }${stored > 0 ? " (draft queued)" : ""}`,
    metadata: {
      companyId,
      company: company.name,
      pagesFetched: pages.length,
      contactsStored: stored,
    },
  };
}
