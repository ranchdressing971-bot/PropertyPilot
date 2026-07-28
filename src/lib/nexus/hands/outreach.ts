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

const MODEL = "gpt-4o-mini";
const MAX_DRAFTS_PER_COMPANY = 1;

/** Minimum contact confidence worth spending a model call on. */
const MIN_CONTACT_CONFIDENCE = 45;

const PRODUCT_BRIEF = `
RideBy is software for HOA and community association managers.

How it works: the manager films a normal drive-through of the community on a
phone. RideBy matches what it sees to house numbers, pulls evidence frames, and
returns a review list of possible violations. The manager approves or discards
each item before anything is sent to a homeowner — the software never contacts
residents on its own.

What it replaces: walking or driving the property with a clipboard, then typing
up notes and matching photos to addresses by hand.

Offer: a free full inspection on the manager's own community video. No card, no
sales call.
`.trim();

const SYSTEM_PROMPT = `
You write short first-touch B2B emails for RideBy, a tool for HOA community managers.

Hard rules:
- 90 words maximum in the body. Shorter is better.
- Plain text. No markdown, no bullet points, no links, no images.
- No greeting fluff ("I hope this email finds you well"), no flattery, no
  invented facts about the recipient's company. You only know what is in the
  context block; do not guess portfolio size, pain points, or history.
- Never claim to have used their product, visited their community, or spoken to
  anyone there.
- One concrete ask: a reply saying yes if they want a free inspection run on a
  video of their own community.
- Subject line: 6 words maximum, lowercase-ish and specific, no clickbait, no
  "Re:" or fake-reply tricks.
- Write like one person emailing another, not like marketing copy.

Return strict JSON only: {"subject": string, "body": string}
The body must end with a line break, then "Isaac" on its own line.
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
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await createChatCompletion(
    {
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Product:\n${PRODUCT_BRIEF}\n\nContext about who you are writing to:\n${context}\n\nWrite the email.`,
        },
      ],
    },
    "nexus-outreach-draft"
  );

  // createChatCompletion's return type covers the streaming case too.
  const raw =
    "choices" in completion
      ? (completion.choices[0]?.message?.content ?? "")
      : "";
  const { subject, body } = parseDraftJson(raw);

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
