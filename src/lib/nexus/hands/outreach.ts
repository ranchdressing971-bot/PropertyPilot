import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import { logAction } from "../jobs";
import type {
  HandResult,
  NexusCompany,
  NexusContact,
  OutreachDraftPayload,
} from "../types";

/**
 * Outreach Hand — writes a personalized first-touch email and files it for
 * human approval.
 *
 * This hand has no send path and imports no mail client. Sending will be a
 * separate hand on a separate domain, because Resend's Acceptable Use Policy
 * bans cold outreach and RideBy's product email shares that account.
 *
 * Two gates run before anything is generated:
 *  1. Suppression list — a matching address or domain stops the draft cold.
 *  2. Existing open draft — one live draft per recipient, enforced in the
 *     database as well as here.
 */

// gpt-4o over mini: cold email quality is the whole point of this hand, and
// the volume is tiny (a handful of drafts per day), so the cost difference is
// noise compared to a bad first impression.
const MODEL = "gpt-4o";
const MAX_DRAFTS_PER_COMPANY = 1;

/** Minimum contact confidence worth spending a model call on. */
const MIN_CONTACT_CONFIDENCE = 45;

const PRODUCT_BRIEF = `
RideBy helps HOA / community association managers do drive-through inspections
without the clipboard grind.

The manager films a normal drive-through on their phone. RideBy matches what it
sees to house numbers, pulls evidence frames, and returns a review list of
possible violations. The manager approves or discards each item — RideBy never
emails homeowners on its own.

The offer in this first email: one free inspection on a video of their own
community. No card. No sales call. CTA is a single link to start — do not ask
them to reply "yes".
`.trim();

function ctaUrl(): string {
  return (
    process.env.NEXUS_OUTREACH_CTA_URL?.trim() ||
    "https://rideby-ai.vercel.app/free"
  );
}

const SYSTEM_PROMPT = `
You write cold first-touch emails from Isaac at RideBy to HOA / community
association managers.

Voice:
- One operator emailing another operator. Short sentences. Concrete words.
- Sound like a human, not a product page. Never use: streamline, leverage,
  cutting-edge, revolutionize, seamless, empower, simplify, simplifies,
  automate, automating, game-changer, synergy.
- Warm but direct. No flattery. No "I hope this finds you well".

Structure (body, in order):
1. One-line opener that uses something real from the context (their name, their
   company name, or their city). If you only have a generic inbox, skip the
   fake familiarity and just be clear.
2. One sentence on the pain they already know: clipboard drive-throughs, then
   matching photos to addresses by hand.
3. One sentence on what RideBy does, in plain English.
4. The offer + CTA: one free inspection on a video of their own community, then
   paste the exact CTA URL from the context on its own line. Do not ask them to
   reply "yes". Do not invent a different URL.

Hard rules:
- 75 words max in the body (URL line does not count). Shorter is better.
- Plain text only. No markdown, bullets, or emojis.
- Exactly one URL in the whole email — the CTA URL provided in context.
- Never invent facts: portfolio size, communities they manage, tools they use,
  or that you've spoken to anyone there. Use only the context block.
- Do not mention pricing, demos, calendars, or "jump on a call".
- Subject: 4–7 words, specific, lowercase-ish, no "free", no "Re:", no
  clickbait, no company-name spam. Aim for curiosity about the job, not the
  product. Good examples of shape: "drive-through notes without the clipboard",
  "faster HOA drive-throughs in Austin". Bad: "free inspection for your community".
- Every draft must feel different from a generic template. If two companies in
  different cities would get the identical body, you failed.

Return strict JSON only: {"subject": string, "body": string}
Body ends with the CTA URL on its own line, then a blank line, then "Isaac".
`.trim();

export function isOutreachConfigured(): boolean {
  return Boolean(getOpenAIApiKey());
}

interface SuppressionHit {
  reason: string;
  scope: "email" | "domain";
}

/**
 * Check both the exact address and its domain. Returns the matching rule so the
 * skip reason can be logged rather than silently dropped.
 */
async function findSuppression(
  email: string,
  db: SupabaseClient
): Promise<SuppressionHit | null> {
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1] ?? "";

  const { data, error } = await db
    .from("nexus_suppressions")
    .select("email, domain, reason")
    .or(`email.ilike.${lower},domain.ilike.${domain}`);

  if (error) {
    // Fail closed: if the suppression list can't be read, do not draft.
    throw new Error(`Suppression check failed: ${error.message}`);
  }

  const hit = (data ?? [])[0] as
    | { email: string | null; domain: string | null; reason: string }
    | undefined;
  if (!hit) return null;

  return { reason: hit.reason, scope: hit.email ? "email" : "domain" };
}

const BANNED_PHRASES = [
  "streamline",
  "streamlining",
  "leverage",
  "cutting-edge",
  "revolutionize",
  "seamless",
  "empower",
  "simplifies",
  "simplify",
  "automating",
  "automate",
  "game-changer",
  "synergy",
];

function draftLooksTemplated(subject: string, body: string): string | null {
  const haystack = `${subject}\n${body}`.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase)) return `banned phrase: ${phrase}`;
  }
  if (/\bfree\b/i.test(subject)) return "subject contains 'free'";
  if (/^re:/i.test(subject)) return "fake reply subject";
  if (/\breply ["']?yes["']?/i.test(body)) return "asks to reply yes instead of linking";
  const expectedUrl = ctaUrl();
  if (!body.includes(expectedUrl)) return "missing CTA URL";
  const urlMatches = body.match(/https?:\/\/\S+/g) ?? [];
  if (urlMatches.length !== 1) return `expected 1 URL, found ${urlMatches.length}`;
  const words = body
    .replace(expectedUrl, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words > 90) return `too long (${words} words)`;
  return null;
}

function parseDraftJson(raw: string): { subject: string; body: string } {
  // Models occasionally wrap JSON in a code fence despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Model did not return JSON: ${raw.slice(0, 200)}`);
  }

  const obj = parsed as { subject?: unknown; body?: unknown };
  const subject = typeof obj.subject === "string" ? obj.subject.trim() : "";
  const body = typeof obj.body === "string" ? obj.body.trim() : "";

  if (!subject || !body) {
    throw new Error("Model response missing subject or body");
  }
  return { subject, body };
}

async function generateDraft(
  context: string
): Promise<{ subject: string; body: string }> {
  let lastRaw = "";
  let lastProblem: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const completion = await createChatCompletion(
      {
        model: MODEL,
        temperature: attempt === 0 ? 0.85 : 0.95,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Product (for your understanding — do not paste this wording):\n${PRODUCT_BRIEF}\n\n` +
              `Who you are writing to:\n${context}\n\n` +
              (attempt === 0 || !lastProblem
                ? `Write one cold email. Make the subject and opener specific to this recipient using only the facts above. Return JSON.`
                : `Your previous draft failed review (${lastProblem}). Rewrite. Include the exact CTA URL on its own line, no "reply yes", no banned marketing words, different subject. Return JSON.`),
          },
        ],
      },
      "nexus-outreach-draft"
    );

    lastRaw =
      "choices" in completion
        ? (completion.choices[0]?.message?.content ?? "")
        : "";
    const parsed = parseDraftJson(lastRaw);
    lastProblem = draftLooksTemplated(parsed.subject, parsed.body);
    if (!lastProblem) return parsed;
  }

  // Last attempt still failed the style check — return it anyway so a human
  // can fix it in review rather than blocking the queue.
  return parseDraftJson(lastRaw);
}

export async function runOutreachDraft(
  payload: OutreachDraftPayload,
  db: SupabaseClient
): Promise<HandResult> {
  const companyId = payload.companyId;
  if (!companyId) throw new Error("outreach.draft requires a companyId");
  if (!isOutreachConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { data: companyRow, error: companyError } = await db
    .from("nexus_companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) throw new Error(`Failed to load company: ${companyError.message}`);
  if (!companyRow) throw new Error(`Company ${companyId} not found`);
  const company = companyRow as NexusCompany;

  if (company.status !== "active") {
    return {
      summary: `skipped — company is ${company.status}`,
      metadata: { companyId },
    };
  }

  const existingDrafts = await db
    .from("nexus_drafts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", ["pending_approval", "approved", "sent"]);

  if ((existingDrafts.count ?? 0) >= MAX_DRAFTS_PER_COMPANY) {
    return {
      summary: "skipped — company already has a draft",
      metadata: { companyId },
    };
  }

  let contactQuery = db
    .from("nexus_contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("confidence", { ascending: false })
    .limit(1);

  if (payload.contactId) {
    contactQuery = db
      .from("nexus_contacts")
      .select("*")
      .eq("id", payload.contactId)
      .limit(1);
  }

  const { data: contactRows, error: contactError } = await contactQuery;
  if (contactError) throw new Error(`Failed to load contacts: ${contactError.message}`);

  const contact = (contactRows ?? [])[0] as NexusContact | undefined;
  if (!contact) {
    return {
      summary: "skipped — no contact found; run research first",
      metadata: { companyId },
    };
  }

  if (contact.confidence < MIN_CONTACT_CONFIDENCE) {
    return {
      summary: `skipped — contact confidence ${contact.confidence} below ${MIN_CONTACT_CONFIDENCE}`,
      metadata: { companyId, email: contact.email },
    };
  }

  const suppression = await findSuppression(contact.email, db);
  if (suppression) {
    await logAction(
      {
        action: "outreach.draft_suppressed",
        entityType: "company",
        entityId: companyId,
        metadata: {
          email: contact.email,
          scope: suppression.scope,
          reason: suppression.reason,
        },
      },
      db
    );
    return {
      summary: `skipped — suppressed (${suppression.reason})`,
      metadata: { companyId, email: contact.email },
    };
  }

  const location = [company.city, company.state].filter(Boolean).join(", ");
  const context = [
    `Company name: ${company.name}`,
    location ? `Location: ${location}` : null,
    company.website ? `Website: ${company.website}` : null,
    contact.name ? `Recipient name: ${contact.name}` : null,
    contact.role ? `Recipient mailbox type: ${contact.role}` : null,
    `Recipient email: ${contact.email}`,
    `CTA URL (paste exactly, on its own line): ${ctaUrl()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { subject, body } = await generateDraft(context);

  // Draft confidence tracks how sure we are about the recipient, not the prose.
  // A generic info@ inbox is a weaker target than a named manager.
  const confidence = Math.min(
    95,
    contact.confidence + (contact.name ? 5 : 0)
  );

  const { data: draft, error: draftError } = await db
    .from("nexus_drafts")
    .insert({
      company_id: companyId,
      contact_id: contact.id,
      to_email: contact.email,
      subject,
      body,
      model: MODEL,
      status: "pending_approval",
      confidence,
      metadata: { sourceUrl: contact.source_url },
    })
    .select("id")
    .single();

  if (draftError) {
    // 23505 = the partial unique index: another open draft exists for this
    // recipient, which is exactly what it is there to prevent.
    if (draftError.code === "23505") {
      return {
        summary: "skipped — an open draft already exists for that address",
        metadata: { companyId, email: contact.email },
      };
    }
    throw new Error(`Failed to store draft: ${draftError.message}`);
  }

  await db
    .from("nexus_companies")
    .update({ stage: "queued", updated_at: new Date().toISOString() })
    .eq("id", companyId);

  await logAction(
    {
      action: "outreach.draft_created",
      entityType: "draft",
      entityId: draft.id,
      confidence,
      metadata: {
        company: company.name,
        to: contact.email,
        subject,
        model: MODEL,
      },
    },
    db
  );

  return {
    summary: `drafted for ${contact.email}`,
    metadata: { companyId, draftId: draft.id, to: contact.email, subject },
  };
}
