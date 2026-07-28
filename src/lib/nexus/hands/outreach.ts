import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import { enqueueJob, logAction } from "../jobs";
import { OUTREACH_AUTO_APPROVE_MIN_SCORE } from "../outreach-policy";
import type {
  HandResult,
  NexusCompany,
  NexusContact,
  OutreachDraftPayload,
  OutreachReviewPayload,
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
RideBy is a small tool Isaac built for HOA managers.

You film a normal drive-through on your phone. It tries to match house numbers
and flags possible issues for you to approve or toss. It does not email
homeowners for you.

First email offer: try one free inspection on a video of their own community.
No card. No call. One link. That is it.
`.trim();

function ctaUrl(): string {
  return (
    process.env.NEXUS_OUTREACH_CTA_URL?.trim() ||
    "https://rideby-ai.vercel.app/free"
  );
}

const SYSTEM_PROMPT = `
You write a short cold email from Isaac (one guy building RideBy) to someone
who manages HOAs / community associations.

This is NOT a sales email, NOT a product launch, NOT a commercial. If it could
air as a 15-second ad, you failed. Write like a peer who noticed a real job
pain and built a small thing — one note, then out.

Voice (non-negotiable):
- Casual, specific, a little blunt. Like a Slack DM or a text, not LinkedIn.
- Contractions are fine (I'm, it's, don't).
- No hype. No polish. No "value prop". No feature list.
- Never sound excited about your own product.

Banned words/phrases (instant fail):
streamline, leverage, cutting-edge, revolutionize, seamless, empower,
simplify/simplifies/simplifying, automate/automating, game-changer, synergy,
transform, innovative, solution, platform, optimize, unlock, elevate,
"reaching out", "wanted to share", "I'd love to", "excited to", "check out",
"save you time", "take your … to the next level", "hope this finds you",
"as an HOA manager", "I noticed your company", "quick question", "just following up".

What to write (body):
- 40–65 words of prose max (URL line does not count). Prefer ~50.
- Open with one specific, true detail from context (name, company, or city).
  If the inbox is generic (info@ / office@), do not fake a personal greeting —
  just start with the job pain.
- Name the clipboard / paper drive-through annoyance in plain words. One beat.
- Say what RideBy does in one plain sentence (phone video → review list). No
  adjectives.
- Soft offer: one free try on their own community video. Then paste the exact
  CTA URL from context on its own line. Do not say "reply yes". Do not invent
  a URL. Do not pitch a demo, call, or pricing.
- Sign off as Isaac only. No title, no "Founder", no "Team RideBy".

Subject:
- 3–6 words. Lowercase ok. About the job, not the product.
- No "free", no "Re:", no company name spam, no exclamation marks.
- Good shape: "clipboard drive-throughs", "hoa notes from a phone video"
- Bad shape: "free AI inspection for your HOA", "transform your inspections"

Anti-template test: if you swap the company name for another HOA shop in another
city and the email still reads identical, rewrite until it doesn't.

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
  "simplifying",
  "automating",
  "automate",
  "game-changer",
  "synergy",
  "transform",
  "innovative",
  "solution",
  "platform",
  "optimize",
  "unlock",
  "elevate",
  "reaching out",
  "wanted to share",
  "i'd love to",
  "excited to",
  "check out",
  "save you time",
  "hope this finds you",
  "as an hoa manager",
  "i noticed your company",
  "quick question",
  "just following up",
  "founder at",
  "team rideby",
];

function draftLooksTemplated(subject: string, body: string): string | null {
  const haystack = `${subject}\n${body}`.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase)) return `banned phrase: ${phrase}`;
  }
  if (/\bfree\b/i.test(subject)) return "subject contains 'free'";
  if (/^re:/i.test(subject)) return "fake reply subject";
  if (/!/.test(subject)) return "subject has exclamation";
  if (/\breply ["']?yes["']?/i.test(body)) return "asks to reply yes instead of linking";
  if (/\bi('m| am) (reaching out|writing|emailing) (because|to)\b/i.test(body)) {
    return "generic commercial opener";
  }
  const expectedUrl = ctaUrl();
  if (!body.includes(expectedUrl)) return "missing CTA URL";
  const urlMatches = body.match(/https?:\/\/\S+/g) ?? [];
  if (urlMatches.length !== 1) return `expected 1 URL, found ${urlMatches.length}`;
  const words = body
    .replace(expectedUrl, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words > 70) return `too long (${words} words)`;
  if (words < 25) return `too short (${words} words)`;
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
                ? `Write one short peer note (not a pitch). Specific to this recipient using only the facts above. Return JSON.`
                : `Previous draft failed (${lastProblem}). Rewrite shorter and more human — no ad voice, no banned phrases, exact CTA URL on its own line. Return JSON.`),
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

  // Auto pipeline: AI reviews the draft next. No human gate.
  await enqueueJob(
    {
      type: "outreach.review",
      payload: { draftId: draft.id } satisfies OutreachReviewPayload,
      dedupeKey: `outreach.review:${draft.id}`,
      delaySeconds: 2,
    },
    db
  );

  return {
    summary: `drafted for ${contact.email} (AI review queued)`,
    metadata: { companyId, draftId: draft.id, to: contact.email, subject },
  };
}

const REVIEW_PROMPT = `
You are a harsh QA gate for RideBy cold outreach. Isaac would rather send
nothing than a commercial-sounding email.

Approve ONLY if ALL are true:
- Reads like a short note from one person to another (Slack/text energy)
- Does NOT sound like an ad, product launch, SaaS pitch, or brochure
- No invented facts about the recipient
- Mentions clipboard / paper drive-through pain in plain words
- Exactly one URL — the expected CTA URL
- Subject is boring-specific about the job (no "free", no "Re:", no !)
- Body prose under ~70 words
- Would not make Isaac cringe if a real manager forwarded it to a friend

Hard reject (score ≤40) if any of these:
- Generic template that would fit any HOA company with a name swap
- Marketing / commercial voice ("reaching out", "excited", "solution", "platform")
- Awkward greeting ("Hello THE TEXAS PROPERTY MANAGER")
- Feature-dumping or hype adjectives
- Asks for a call, demo, or "reply yes"

Return strict JSON only:
{"decision":"approve"|"reject","score":0-100,"reason":"short plain reason"}
`.trim();

/**
 * AI review gate. Approves drafts into the send-ready queue or rejects them.
 * This replaces human approval — outreach is meant to run while Isaac is AFK.
 */
export async function runOutreachReview(
  payload: OutreachReviewPayload,
  db: SupabaseClient
): Promise<HandResult> {
  const draftId = payload.draftId;
  if (!draftId) throw new Error("outreach.review requires a draftId");
  if (!isOutreachConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { data: draft, error } = await db
    .from("nexus_drafts")
    .select("id, company_id, to_email, subject, body, status, confidence, metadata")
    .eq("id", draftId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load draft: ${error.message}`);
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  if (draft.status !== "pending_approval") {
    return {
      summary: `skipped — draft is ${draft.status}`,
      metadata: { draftId },
    };
  }

  const expectedUrl = ctaUrl();
  const completion = await createChatCompletion(
    {
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REVIEW_PROMPT },
        {
          role: "user",
          content:
            `Expected CTA URL: ${expectedUrl}\n\n` +
            `To: ${draft.to_email}\n` +
            `Subject: ${draft.subject}\n\n` +
            `${draft.body}`,
        },
      ],
    },
    "nexus-outreach-review"
  );

  const raw =
    "choices" in completion
      ? (completion.choices[0]?.message?.content ?? "")
      : "";
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let decision: "approve" | "reject" = "reject";
  let score = 0;
  let reason = "review parse failed";
  try {
    const parsed = JSON.parse(cleaned) as {
      decision?: string;
      score?: number;
      reason?: string;
    };
    if (parsed.decision === "approve" || parsed.decision === "reject") {
      decision = parsed.decision;
    }
    if (typeof parsed.score === "number") {
      score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    }
    if (typeof parsed.reason === "string" && parsed.reason.trim()) {
      reason = parsed.reason.trim().slice(0, 500);
    }
  } catch {
    decision = "reject";
    reason = `review returned non-JSON: ${raw.slice(0, 160)}`;
  }

  // Hard mechanical gates on top of the model — never auto-approve a draft that
  // fails the obvious checks even if the model says yes.
  const mechanical = draftLooksTemplated(draft.subject, draft.body);
  if (mechanical) {
    decision = "reject";
    reason = mechanical;
    score = Math.min(score, 40);
  } else if (
    decision === "approve" &&
    score < OUTREACH_AUTO_APPROVE_MIN_SCORE
  ) {
    decision = "reject";
    reason = `score ${score} below auto-approve floor ${OUTREACH_AUTO_APPROVE_MIN_SCORE}`;
  }

  const now = new Date().toISOString();
  const approving = decision === "approve";

  await db
    .from("nexus_drafts")
    .update({
      status: approving ? "approved" : "rejected",
      confidence: score,
      rejection_reason: approving ? null : reason,
      reviewed_at: now,
      reviewed_by: "nexus-ai",
      updated_at: now,
      metadata: {
        ...((draft.metadata as Record<string, unknown> | null) ?? {}),
        aiReview: { decision, score, reason },
      },
    })
    .eq("id", draftId);

  await db
    .from("nexus_companies")
    .update({
      stage: approving ? "queued" : "ready",
      updated_at: now,
    })
    .eq("id", draft.company_id);

  await logAction(
    {
      action: approving
        ? "outreach.draft_auto_approved"
        : "outreach.draft_auto_rejected",
      entityType: "draft",
      entityId: draftId,
      confidence: score,
      metadata: { to: draft.to_email, reason, score },
    },
    db
  );

  return {
    summary: approving
      ? `auto-approved (${score}) for ${draft.to_email}`
      : `auto-rejected (${score}): ${reason}`,
    metadata: { draftId, decision, score, reason },
  };
}
