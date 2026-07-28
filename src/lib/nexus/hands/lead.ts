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
      },
      { targetCity }
    );

    // Does this place already exist? Checked explicitly so we can report
    // duplicates rather than silently overwriting.
    const { data: existing } = await db
      .from("nexus_companies")
      .select("id, status")
      .eq("place_id", place.id)
      .maybeSingle();

    if (existing) {
      duplicates += 1;
      // A previously-active national that now matches the blocklist gets
      // demoted in place, so re-runs clean the list without creating orphans.
      if (!verdict.ok && existing.status === "active") {
        await db
          .from("nexus_companies")
          .update({
            status: "disqualified",
            disqualified_reason: verdict.reason ?? "filtered",
            updated_at: now,
          })
          .eq("id", existing.id);
        filtered += 1;
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
