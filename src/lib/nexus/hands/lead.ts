import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob, logAction } from "../jobs";
import { cityFromQuery, evaluateLead } from "../lead-filter";
import type { HandResult, LeadSearchPayload } from "../types";

/**
 * Lead Hand — finds companies via Google Places Text Search (New) and stores
 * them in Atlas.
 *
 * Billing note: Places bills by the most expensive SKU in the field mask.
 * `websiteUri` and `nationalPhoneNumber` are Enterprise-tier fields (1,000 free
 * calls/month, then ~$35 per 1,000), so the mask below is kept to exactly what
 * outreach needs. Each request returns up to 20 places, so 1,000 calls covers
 * roughly 20,000 companies.
 *
 * Storage note: Google permits caching `place_id` indefinitely. Other fields
 * are treated as refreshable, tracked by `places_synced_at`.
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  // Review count is the size signal. Already on the Enterprise SKU we hit for
  // website/phone, so it adds no extra Places charge.
  "places.userRatingCount",
  "places.rating",
  "nextPageToken",
].join(",");

const DEFAULT_MAX_RESULTS = 60;

interface PlacesAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface PlacesResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: PlacesAddressComponent[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  userRatingCount?: number;
  rating?: number;
}

interface PlacesResponse {
  places?: PlacesResult[];
  nextPageToken?: string;
}

export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

function componentOf(
  components: PlacesAddressComponent[] | undefined,
  type: string
): string | null {
  const match = components?.find((c) => c.types?.includes(type));
  return match?.shortText ?? match?.longText ?? null;
}

async function searchPlaces(
  query: string,
  pageToken?: string
): Promise<PlacesResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  const response = await fetch(PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      ...(pageToken ? { pageToken } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Places search failed (${response.status}): ${detail.slice(0, 500)}`
    );
  }

  return (await response.json()) as PlacesResponse;
}

/**
 * Run one page of a lead search. If more pages remain and the result cap has not
 * been hit, requeues itself with the next page token instead of looping — that
 * keeps every invocation well inside the function timeout.
 */
export async function runLeadSearch(
  payload: LeadSearchPayload,
  db: SupabaseClient
): Promise<HandResult> {
  const query = payload.query?.trim();
  if (!query) {
    throw new Error("lead.search requires a non-empty query");
  }

  const maxResults = payload.maxResults ?? DEFAULT_MAX_RESULTS;
  const storedSoFar = payload.storedSoFar ?? 0;
  const targetCity = cityFromQuery(query);

  const response = await searchPlaces(query, payload.pageToken);
  const places = response.places ?? [];

  let stored = 0;
  let duplicates = 0;
  let filtered = 0;
  const now = new Date().toISOString();

  for (const place of places) {
    if (storedSoFar + stored >= maxResults) break;
    if (!place.id || !place.displayName?.text) continue;

    const city = componentOf(place.addressComponents, "locality");
    const state = componentOf(
      place.addressComponents,
      "administrative_area_level_1"
    );
    const verdict = evaluateLead(
      {
        name: place.displayName.text,
        website: place.websiteUri ?? null,
        city,
        userRatingCount: place.userRatingCount ?? null,
      },
      { targetCity }
    );

    const placesMeta = {
      userRatingCount: place.userRatingCount ?? null,
      rating: place.rating ?? null,
    };

    // Does this place already exist? Checked explicitly so we can report
    // duplicates rather than silently overwriting.
    const { data: existing } = await db
      .from("nexus_companies")
      .select("id, status, metadata")
      .eq("place_id", place.id)
      .maybeSingle();

    if (existing) {
      duplicates += 1;
      const nextMeta = {
        ...((existing.metadata as Record<string, unknown> | null) ?? {}),
        ...placesMeta,
      };
      // A previously-active company that now fails the filter gets demoted in
      // place, so re-runs clean the list without creating orphans.
      if (!verdict.ok && existing.status === "active") {
        await db
          .from("nexus_companies")
          .update({
            status: "disqualified",
            disqualified_reason: verdict.reason ?? "filtered",
            metadata: nextMeta,
            updated_at: now,
          })
          .eq("id", existing.id);
        filtered += 1;
      } else {
        await db
          .from("nexus_companies")
          .update({ metadata: nextMeta, places_synced_at: now, updated_at: now })
          .eq("id", existing.id);
      }
      continue;
    }

    if (!verdict.ok) {
      filtered += 1;
      // Still insert, but marked disqualified — keeps Place ID reserved so a
      // later search cannot resurrect it as an active lead.
      const { data: rejected, error: rejectError } = await db
        .from("nexus_companies")
        .insert({
          place_id: place.id,
          name: place.displayName.text,
          website: place.websiteUri ?? null,
          phone: place.nationalPhoneNumber ?? null,
          address: place.formattedAddress ?? null,
          city,
          state,
          source: "places",
          search_query: query,
          stage: "lost",
          status: "disqualified",
          disqualified_reason: verdict.reason ?? "filtered",
          places_synced_at: now,
          metadata: placesMeta,
        })
        .select("id, name")
        .single();

      if (rejectError) {
        if (rejectError.code === "23505") {
          duplicates += 1;
          continue;
        }
        throw new Error(
          `Failed to store filtered ${place.displayName.text}: ${rejectError.message}`
        );
      }

      await logAction(
        {
          action: "lead.company_filtered",
          entityType: "company",
          entityId: rejected.id,
          metadata: {
            name: rejected.name,
            query,
            reason: verdict.reason,
            userRatingCount: place.userRatingCount ?? null,
          },
        },
        db
      );
      continue;
    }

    const { data: inserted, error } = await db
      .from("nexus_companies")
      .insert({
        place_id: place.id,
        name: place.displayName.text,
        website: place.websiteUri ?? null,
        phone: place.nationalPhoneNumber ?? null,
        address: place.formattedAddress ?? null,
        city,
        state,
        source: "places",
        search_query: query,
        stage: "new",
        places_synced_at: now,
        metadata: placesMeta,
      })
      .select("id, name")
      .single();

    if (error) {
      // Another tick may have inserted the same place between our check and
      // this insert; the unique index is the real guard.
      if (error.code === "23505") {
        duplicates += 1;
        continue;
      }
      throw new Error(`Failed to store ${place.displayName.text}: ${error.message}`);
    }

    stored += 1;
    await logAction(
      {
        action: "lead.company_found",
        entityType: "company",
        entityId: inserted.id,
        metadata: {
          name: inserted.name,
          query,
          hasWebsite: Boolean(place.websiteUri),
          userRatingCount: place.userRatingCount ?? null,
        },
      },
      db
    );
  }

  const totalStored = storedSoFar + stored;
  const morePages = Boolean(response.nextPageToken) && totalStored < maxResults;

  if (morePages) {
    await enqueueJob(
      {
        type: "lead.search",
        payload: {
          query,
          maxResults,
          pageToken: response.nextPageToken,
          storedSoFar: totalStored,
        } satisfies LeadSearchPayload,
        // Places asks for a short pause before using a page token.
        delaySeconds: 5,
      },
      db
    );
  }

  return {
    summary:
      `${stored} new, ${duplicates} duplicate, ${filtered} filtered` +
      (morePages ? ", next page queued" : ""),
    metadata: {
      query,
      stored,
      duplicates,
      filtered,
      targetCity,
      totalStored,
      morePages,
    },
  };
}

/**
 * Re-check one existing company against Places review count. Used to apply the
 * size filter to leads that were imported before userRatingCount was fetched.
 */
export async function runLeadScore(
  payload: { companyId: string },
  db: SupabaseClient
): Promise<HandResult> {
  const companyId = payload.companyId;
  if (!companyId) throw new Error("lead.score requires a companyId");

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not configured");

  const { data: company, error } = await db
    .from("nexus_companies")
    .select("id, name, place_id, website, city, status, metadata")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load company: ${error.message}`);
  if (!company) throw new Error(`Company ${companyId} not found`);
  if (!company.place_id) {
    return { summary: "skipped — no place_id", metadata: { companyId } };
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${company.place_id}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,userRatingCount,rating,websiteUri",
      },
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Place Details failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  const place = (await response.json()) as {
    userRatingCount?: number;
    rating?: number;
    websiteUri?: string;
  };

  const userRatingCount = place.userRatingCount ?? 0;
  const now = new Date().toISOString();
  const nextMeta = {
    ...((company.metadata as Record<string, unknown> | null) ?? {}),
    userRatingCount,
    rating: place.rating ?? null,
  };

  const verdict = evaluateLead({
    name: company.name,
    website: company.website ?? place.websiteUri ?? null,
    city: company.city,
    userRatingCount,
  });

  if (!verdict.ok && company.status === "active") {
    await db
      .from("nexus_companies")
      .update({
        status: "disqualified",
        disqualified_reason: verdict.reason ?? "filtered",
        metadata: nextMeta,
        places_synced_at: now,
        updated_at: now,
      })
      .eq("id", companyId);

    await logAction(
      {
        action: "lead.company_filtered",
        entityType: "company",
        entityId: companyId,
        metadata: {
          name: company.name,
          reason: verdict.reason,
          userRatingCount,
        },
      },
      db
    );

    return {
      summary: `filtered ${company.name} (${userRatingCount} reviews)`,
      metadata: { companyId, userRatingCount, reason: verdict.reason },
    };
  }

  await db
    .from("nexus_companies")
    .update({
      metadata: nextMeta,
      places_synced_at: now,
      updated_at: now,
    })
    .eq("id", companyId);

  return {
    summary: `scored ${company.name} (${userRatingCount} reviews)`,
    metadata: { companyId, userRatingCount, kept: true },
  };
}

