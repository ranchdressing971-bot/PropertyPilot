/**
 * Lead quality filters for the Lead Hand.
 *
 * Size signal: Google Places `userRatingCount`. A storefront with hundreds of
 * reviews is almost never a small local HOA shop; one with a handful usually is.
 * That is imperfect (a quiet national office can look small), so a short brand
 * blocklist still catches known nationals, and a city hint stops Places from
 * handing us Houston results for an Austin query.
 *
 * Matches are not deleted. They are stored (or updated) as status=disqualified
 * so the action log stays honest and a re-run cannot resurrect them as leads.
 */

export interface LeadCandidate {
  name: string;
  website?: string | null;
  city?: string | null;
  /** Google Places userRatingCount — number of Google reviews. */
  userRatingCount?: number | null;
}

export interface LeadFilterResult {
  ok: boolean;
  reason?: string;
}

/**
 * Soft ceiling on Google reviews. Tunable via NEXUS_MAX_REVIEW_COUNT.
 * 75 keeps quiet local shops and cuts the loud regional/national offices.
 */
export function maxReviewCount(): number {
  const raw = Number(process.env.NEXUS_MAX_REVIEW_COUNT ?? 75);
  if (!Number.isFinite(raw) || raw < 1) return 75;
  return Math.floor(raw);
}

/** National / multi-state brands and franchises we do not want as first-touch leads. */
const BLOCKED_NAME_PATTERNS: RegExp[] = [
  /\bassocia\b/i,
  /\bfirstservice\b/i,
  /\brealmanage\b/i,
  /\bspectrum association\b/i,
  /\browcal\b/i,
  /\bthe management trust\b/i,
  /\bcitadel\b/i,
  /\bgoosmann\b/i,
  /\bcmc association\b/i,
  /\bcommunity management associates\b/i,
  /\bbay property management group\b/i,
  /\bevernest\b/i,
  /\bkeyrenter\b/i,
  /\breal property management\b/i,
  /\bpmi\b/i,
  /\bproperty management inc\b/i,
  /\bziprent\b/i,
  /\bworth ross\b/i,
  /\bcrest management\b/i,
  /\brise association management\b/i,
  /\bsbb community\b/i,
  /\ball county capital\b/i,
];

const BLOCKED_DOMAINS = [
  "associaonline.com",
  "associahillcountry.com",
  "fsresidential.com",
  "realmanage.com",
  "spectrumam.com",
  "rowcal.com",
  "managementtrust.com",
  "texasbmg.com",
  "evernest.com",
  "keyrenteraustin.com",
  "keyrenter.com",
  "realpropertymgt.com",
  "rpmallconnect.com",
  "rpmrentsmart.com",
  "ziprent.com",
  "wrmcinc.com",
  "crest-management.com",
  "riseamg.com",
  "sbbmanagement.com",
  "allcountycapital.com",
  "austinbnbmanagement.com",
  "nomadstr.net",
  "strmanagement.com",
  "vialuxuryrentals.com",
];

/** STR / vacation-rental patterns — not HOA managers. */
const NON_HOA_NAME_PATTERNS: RegExp[] = [
  /\bbnb\b/i,
  /\bstr\b/i,
  /\bshort[- ]term\b/i,
  /\bvacation rental\b/i,
  /\bluxury rentals?\b/i,
  /\bairbnb\b/i,
];

function hostnameOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Pull a target city out of queries like "HOA management company in Austin TX".
 * Returns null when the query has no clear city so we don't over-filter.
 */
export function cityFromQuery(query: string): string | null {
  const match = query.match(
    /\bin\s+([A-Za-z .'-]+?)(?:\s*,?\s*[A-Z]{2})?\s*$/i
  );
  if (!match) return null;
  const city = match[1].trim().replace(/\s+/g, " ");
  if (/^(texas|tx|california|florida|arizona|north carolina)$/i.test(city)) {
    return null;
  }
  return city;
}

function citiesMatch(actual: string | null | undefined, target: string): boolean {
  if (!actual) return false;
  const a = actual.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  return a === t || a.includes(t) || t.includes(a);
}

export function evaluateLead(
  candidate: LeadCandidate,
  opts?: { targetCity?: string | null; maxReviews?: number }
): LeadFilterResult {
  const name = candidate.name.trim();
  const maxReviews = opts?.maxReviews ?? maxReviewCount();

  for (const pattern of NON_HOA_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { ok: false, reason: "not_hoa_manager" };
    }
  }

  // Review count is the primary size signal — cheap, objective, and already on
  // the Enterprise SKU we pay for website/phone.
  if (
    typeof candidate.userRatingCount === "number" &&
    candidate.userRatingCount > maxReviews
  ) {
    return { ok: false, reason: "too_many_reviews" };
  }

  for (const pattern of BLOCKED_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { ok: false, reason: "national_or_franchise" };
    }
  }

  const host = hostnameOf(candidate.website);
  if (host && BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { ok: false, reason: "national_or_franchise" };
  }

  if (opts?.targetCity && !citiesMatch(candidate.city, opts.targetCity)) {
    return { ok: false, reason: "outside_target_city" };
  }

  return { ok: true };
}
