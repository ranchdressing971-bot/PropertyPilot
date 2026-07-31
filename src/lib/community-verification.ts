/**
 * RideBy Community Verification — soft fingerprinting to keep community maps
 * organized. Never suspends, locks, or blocks inspections.
 *
 * Soft-gated: off in production until COMMUNITY_VERIFICATION_ENABLED=true.
 * Missing tables → silent no-op. Learn-and-ask only (optional prompts).
 */

import {
  addressDedupeKey,
  extractHouseNumber,
  isPlaceholderAddress,
  streetCore,
} from "@/lib/address-normalize";
import { normalizeCommunityKey } from "@/lib/community-key";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UploadGeoContext } from "@/lib/geo/types";

/** Soft thresholds — helpful organizing, not policing. */
export const SMALL_NEW_HOME_MAX = 8;
export const SMALL_NEW_HOME_RATIO = 0.18;
export const MATCH_RATIO_OK = 0.55;
export const LARGE_DIFF_MATCH_RATIO = 0.35;
/** Consecutive unresolved large diffs before a soft manual-review flag (never blocks). */
export const MISUSE_STREAK_TO_FLAG = 3;

/**
 * Opt-in gate. Production stays off until explicitly enabled after SQL is applied.
 * Development defaults on so local testing works without an env flip.
 */
export function isCommunityVerificationEnabled(): boolean {
  const flag = process.env.COMMUNITY_VERIFICATION_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return process.env.NODE_ENV === "development";
}

export type VerificationOutcome =
  | "bootstrap"
  | "match"
  | "small_expansion"
  | "large_difference"
  | "ignored_new"
  | "expanded"
  | "new_community_suggested";

export type VerificationResolution =
  | "confirm_new_homes"
  | "ignore_new_homes"
  | "expand_fingerprint"
  | "create_new_community"
  | "dismiss";

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM?: number;
  heading?: number;
  t?: number;
}

export interface SoftBoundary {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centroidLat: number;
  centroidLng: number;
  radiusM: number;
}

export interface CommunityFingerprintSnapshot {
  addressKeys: string[];
  addresses: string[];
  roadsCovered: string[];
  routePoints: GeoPoint[];
  boundary: SoftBoundary | null;
  entrances: GeoPoint[];
  centroidLat: number | null;
  centroidLng: number | null;
  radiusM: number | null;
}

export interface CommunityVerificationResult {
  outcome: VerificationOutcome;
  eventId: string | null;
  fingerprintId: string | null;
  matchRatio: number;
  knownCount: number;
  newCount: number;
  missingCount: number;
  newAddresses: string[];
  observedAddresses: string[];
  observedRoads: string[];
  helpfulMessage: string;
  needsUserAction: boolean;
  flaggedForReview: boolean;
  communityName: string;
}

export interface ObservedInspectionSignal {
  inspectionId: string;
  communityName: string;
  communityKey: string;
  companyId: string | null;
  userId: string;
  addresses: string[];
  geo?: UploadGeoContext | null;
  routePoints?: GeoPoint[];
}

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizeObservedAddresses(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of raw) {
    const trimmed = addr?.trim();
    if (!trimmed || isPlaceholderAddress(trimmed)) continue;
    if (!extractHouseNumber(trimmed)) continue;
    const key = addressDedupeKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function roadsFromAddresses(addresses: string[]): string[] {
  const roads = new Set<string>();
  for (const a of addresses) {
    const core = streetCore(a);
    if (core && core.length >= 3) roads.add(core);
  }
  return [...roads].sort();
}

export function buildSoftBoundary(points: GeoPoint[]): SoftBoundary | null {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    sumLat += p.lat;
    sumLng += p.lng;
  }
  const centroid: GeoPoint = {
    lat: sumLat / points.length,
    lng: sumLng / points.length,
  };
  let radiusM = 80;
  for (const p of points) {
    radiusM = Math.max(radiusM, haversineM(centroid, p));
  }
  // Soft pad so honest partial drives still fit
  radiusM = Math.round(radiusM * 1.35 + 60);
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centroidLat: centroid.lat,
    centroidLng: centroid.lng,
    radiusM,
  };
}

/** First/last track points as crude entrance candidates. */
export function detectEntrances(route: GeoPoint[]): GeoPoint[] {
  if (route.length === 0) return [];
  if (route.length === 1) return [{ ...route[0] }];
  const first = route[0];
  const last = route[route.length - 1];
  if (haversineM(first, last) < 40) return [{ ...first }];
  return [{ ...first }, { ...last }];
}

export function buildSnapshotFromObservation(
  addresses: string[],
  geo?: UploadGeoContext | null,
  routePoints?: GeoPoint[]
): CommunityFingerprintSnapshot {
  const cleaned = normalizeObservedAddresses(addresses);
  const keys = cleaned.map((a) => addressDedupeKey(a)).sort();
  const roads = roadsFromAddresses(cleaned);
  const route: GeoPoint[] =
    routePoints && routePoints.length > 0
      ? routePoints
      : geo?.lat != null && geo?.lng != null
        ? [
            {
              lat: geo.lat,
              lng: geo.lng,
              accuracyM: geo.accuracyM,
              heading: geo.heading,
              t: Date.now(),
            },
          ]
        : [];
  const boundary = buildSoftBoundary(route);
  const entrances = detectEntrances(route);
  return {
    addressKeys: keys,
    addresses: cleaned,
    roadsCovered: roads,
    routePoints: route,
    boundary,
    entrances,
    centroidLat: boundary?.centroidLat ?? geo?.lat ?? null,
    centroidLng: boundary?.centroidLng ?? geo?.lng ?? null,
    radiusM: boundary?.radiusM ?? null,
  };
}

function compareSnapshots(
  baseline: CommunityFingerprintSnapshot,
  observed: CommunityFingerprintSnapshot
): {
  matchRatio: number;
  knownCount: number;
  newCount: number;
  missingCount: number;
  newAddresses: string[];
  outcome: VerificationOutcome;
} {
  const baseKeys = new Set(baseline.addressKeys);
  const obsKeys = new Set(observed.addressKeys);
  let knownCount = 0;
  const newAddresses: string[] = [];
  for (let i = 0; i < observed.addressKeys.length; i++) {
    const key = observed.addressKeys[i];
    if (baseKeys.has(key)) knownCount += 1;
    else newAddresses.push(observed.addresses[i] ?? key);
  }
  let missingCount = 0;
  for (const key of baseKeys) {
    if (!obsKeys.has(key)) missingCount += 1;
  }

  // Of observed homes, how many were already known (partial drives still match)
  const observedMatch =
    observed.addressKeys.length === 0
      ? 0
      : knownCount / observed.addressKeys.length;

  const newCount = newAddresses.length;
  const smallExpansion =
    newCount > 0 &&
    newCount <= SMALL_NEW_HOME_MAX &&
    newCount / Math.max(1, observed.addressKeys.length) <= SMALL_NEW_HOME_RATIO &&
    observedMatch >= MATCH_RATIO_OK;

  let outcome: VerificationOutcome;
  if (observed.addressKeys.length === 0) {
    outcome = "match"; // nothing to judge — stay quiet
  } else if (baseKeys.size === 0) {
    outcome = "bootstrap";
  } else if (newCount === 0 && observedMatch >= MATCH_RATIO_OK) {
    outcome = "match";
  } else if (smallExpansion) {
    outcome = "small_expansion";
  } else if (
    observedMatch < LARGE_DIFF_MATCH_RATIO ||
    (newCount > SMALL_NEW_HOME_MAX && observedMatch < MATCH_RATIO_OK)
  ) {
    outcome = "large_difference";
  } else if (newCount > 0 && observedMatch >= MATCH_RATIO_OK) {
    outcome = "small_expansion";
  } else {
    outcome = "large_difference";
  }

  return {
    matchRatio: Math.round(observedMatch * 1000) / 1000,
    knownCount,
    newCount,
    missingCount,
    newAddresses,
    outcome,
  };
}

function helpfulMessageFor(
  outcome: VerificationOutcome,
  communityName: string,
  newCount: number
): string {
  switch (outcome) {
    case "bootstrap":
      return `Saved a starting map for ${communityName} from this drive. Optional — helps keep future reports organized.`;
    case "match":
      return `Looks like the same community — most homes match ${communityName}.`;
    case "small_expansion":
      return `We noticed ${newCount} home${newCount === 1 ? "" : "s"} that haven’t shown up in ${communityName} yet. Want to add them to this community’s map?`;
    case "large_difference":
      return `This drive covers streets that look different from ${communityName}. You can expand this community’s map, keep it separate later, or skip — your inspection is already saved.`;
    default:
      return `Community map tip for ${communityName}.`;
  }
}

function isMissingRelationError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("community_fingerprints") ||
    msg.includes("community_verification_events") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function rowToSnapshot(row: {
  address_keys?: string[] | null;
  addresses?: string[] | null;
  roads_covered?: string[] | null;
  route_points?: GeoPoint[] | null;
  boundary?: SoftBoundary | Record<string, unknown> | null;
  entrances?: GeoPoint[] | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  radius_m?: number | null;
}): CommunityFingerprintSnapshot {
  const boundary =
    row.boundary &&
    typeof row.boundary === "object" &&
    "centroidLat" in row.boundary
      ? (row.boundary as SoftBoundary)
      : null;
  return {
    addressKeys: row.address_keys ?? [],
    addresses: row.addresses ?? [],
    roadsCovered: row.roads_covered ?? [],
    routePoints: (row.route_points as GeoPoint[]) ?? [],
    boundary,
    entrances: (row.entrances as GeoPoint[]) ?? [],
    centroidLat: row.centroid_lat ?? null,
    centroidLng: row.centroid_lng ?? null,
    radiusM: row.radius_m ?? null,
  };
}

function mergeSnapshots(
  base: CommunityFingerprintSnapshot,
  add: CommunityFingerprintSnapshot
): CommunityFingerprintSnapshot {
  const keyToAddr = new Map<string, string>();
  for (let i = 0; i < base.addressKeys.length; i++) {
    keyToAddr.set(base.addressKeys[i], base.addresses[i] ?? base.addressKeys[i]);
  }
  for (let i = 0; i < add.addressKeys.length; i++) {
    if (!keyToAddr.has(add.addressKeys[i])) {
      keyToAddr.set(add.addressKeys[i], add.addresses[i] ?? add.addressKeys[i]);
    }
  }
  const addressKeys = [...keyToAddr.keys()].sort();
  const addresses = addressKeys.map((k) => keyToAddr.get(k)!);
  const roads = [...new Set([...base.roadsCovered, ...add.roadsCovered])].sort();
  const routePoints = [...base.routePoints, ...add.routePoints].slice(-200);
  const boundary = buildSoftBoundary(routePoints);
  const entrances = detectEntrances(routePoints);
  return {
    addressKeys,
    addresses,
    roadsCovered: roads,
    routePoints,
    boundary,
    entrances,
    centroidLat: boundary?.centroidLat ?? base.centroidLat,
    centroidLng: boundary?.centroidLng ?? base.centroidLng,
    radiusM: boundary?.radiusM ?? base.radiusM,
  };
}

async function loadFingerprint(opts: {
  companyId: string | null;
  userId: string;
  communityKey: string;
}): Promise<{
  id: string;
  misuse_streak: number;
  flagged_for_review: boolean;
  snapshot: CommunityFingerprintSnapshot;
} | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  let query = admin
    .from("community_fingerprints")
    .select("*")
    .eq("community_key", opts.communityKey)
    .limit(1);

  if (opts.companyId) {
    query = query.eq("company_id", opts.companyId);
  } else {
    query = query.eq("user_id", opts.userId).is("company_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        "community_fingerprints missing — run docs/COMMUNITY_VERIFICATION_SCHEMA.sql"
      );
      return null;
    }
    console.error("loadFingerprint:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id as string,
    misuse_streak: Number(data.misuse_streak) || 0,
    flagged_for_review: Boolean(data.flagged_for_review),
    snapshot: rowToSnapshot(data),
  };
}

async function insertFingerprint(opts: {
  companyId: string | null;
  userId: string;
  communityKey: string;
  hoaName: string;
  inspectionId: string;
  snapshot: CommunityFingerprintSnapshot;
}): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("community_fingerprints")
    .insert({
      company_id: opts.companyId,
      user_id: opts.userId,
      community_key: opts.communityKey,
      hoa_name: opts.hoaName,
      address_keys: opts.snapshot.addressKeys,
      addresses: opts.snapshot.addresses,
      roads_covered: opts.snapshot.roadsCovered,
      route_points: opts.snapshot.routePoints,
      boundary: opts.snapshot.boundary ?? {},
      entrances: opts.snapshot.entrances,
      centroid_lat: opts.snapshot.centroidLat,
      centroid_lng: opts.snapshot.centroidLng,
      radius_m: opts.snapshot.radiusM,
      sample_count: 1,
      baseline_inspection_id: opts.inspectionId,
      misuse_streak: 0,
      flagged_for_review: false,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        "community_fingerprints missing — run docs/COMMUNITY_VERIFICATION_SCHEMA.sql"
      );
      return null;
    }
    console.error("insertFingerprint:", error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

async function updateFingerprint(
  fingerprintId: string,
  snapshot: CommunityFingerprintSnapshot,
  patch: {
    sampleCountInc?: number;
    misuseStreak?: number;
    flaggedForReview?: boolean;
    reviewNote?: string | null;
  } = {}
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: current } = await admin
    .from("community_fingerprints")
    .select("sample_count")
    .eq("id", fingerprintId)
    .maybeSingle();

  const sample =
    (Number(current?.sample_count) || 0) + (patch.sampleCountInc ?? 0);

  await admin
    .from("community_fingerprints")
    .update({
      address_keys: snapshot.addressKeys,
      addresses: snapshot.addresses,
      roads_covered: snapshot.roadsCovered,
      route_points: snapshot.routePoints,
      boundary: snapshot.boundary ?? {},
      entrances: snapshot.entrances,
      centroid_lat: snapshot.centroidLat,
      centroid_lng: snapshot.centroidLng,
      radius_m: snapshot.radiusM,
      sample_count: sample,
      ...(patch.misuseStreak != null
        ? { misuse_streak: patch.misuseStreak }
        : {}),
      ...(patch.flaggedForReview != null
        ? { flagged_for_review: patch.flaggedForReview }
        : {}),
      ...(patch.reviewNote !== undefined
        ? { review_note: patch.reviewNote }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", fingerprintId);
}

async function insertEvent(row: Record<string, unknown>): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("community_verification_events")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        "community_verification_events missing — run docs/COMMUNITY_VERIFICATION_SCHEMA.sql"
      );
      return null;
    }
    console.error("insert verification event:", error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

/**
 * After analysis: bootstrap or compare against the community fingerprint.
 * Soft UX only — never blocks the inspection from saving.
 */
export async function runCommunityVerification(
  signal: ObservedInspectionSignal
): Promise<CommunityVerificationResult> {
  const communityName = signal.communityName.trim() || "Your Community";
  const communityKey =
    signal.communityKey || normalizeCommunityKey(communityName) || "unknown";

  const observed = buildSnapshotFromObservation(
    signal.addresses,
    signal.geo,
    signal.routePoints
  );

  const empty: CommunityVerificationResult = {
    outcome: "match",
    eventId: null,
    fingerprintId: null,
    matchRatio: 1,
    knownCount: 0,
    newCount: 0,
    missingCount: 0,
    newAddresses: [],
    observedAddresses: observed.addresses,
    observedRoads: observed.roadsCovered,
    helpfulMessage: "",
    needsUserAction: false,
    flaggedForReview: false,
    communityName,
  };

  // Soft gate: production stays quiet until explicitly enabled
  if (!isCommunityVerificationEnabled()) {
    return empty;
  }

  if (!createAdminClient()) {
    return empty;
  }

  const existing = await loadFingerprint({
    companyId: signal.companyId,
    userId: signal.userId,
    communityKey,
  });

  // First completed inspection → baseline
  if (!existing) {
    if (observed.addresses.length === 0) {
      return {
        ...empty,
        outcome: "bootstrap",
        helpfulMessage: `We’ll gently learn ${communityName}’s streets as addresses are confirmed — nothing to do right now.`,
      };
    }

    const fingerprintId = await insertFingerprint({
      companyId: signal.companyId,
      userId: signal.userId,
      communityKey,
      hoaName: communityName,
      inspectionId: signal.inspectionId,
      snapshot: observed,
    });

    const eventId = await insertEvent({
      fingerprint_id: fingerprintId,
      company_id: signal.companyId,
      user_id: signal.userId,
      community_key: communityKey,
      inspection_id: signal.inspectionId,
      outcome: "bootstrap",
      match_ratio: 1,
      known_count: observed.addresses.length,
      new_count: 0,
      missing_count: 0,
      new_addresses: [],
      observed_addresses: observed.addresses,
      observed_roads: observed.roadsCovered,
      geo_lat: observed.centroidLat,
      geo_lng: observed.centroidLng,
      route_points: observed.routePoints,
      flagged_for_review: false,
      helpful_message: helpfulMessageFor("bootstrap", communityName, 0),
      metadata: { roads: observed.roadsCovered, entrances: observed.entrances },
    });

    return {
      outcome: "bootstrap",
      eventId,
      fingerprintId,
      matchRatio: 1,
      knownCount: observed.addresses.length,
      newCount: 0,
      missingCount: 0,
      newAddresses: [],
      observedAddresses: observed.addresses,
      observedRoads: observed.roadsCovered,
      helpfulMessage: helpfulMessageFor("bootstrap", communityName, 0),
      needsUserAction: false,
      flaggedForReview: false,
      communityName,
    };
  }

  const cmp = compareSnapshots(existing.snapshot, observed);
  let misuseStreak = existing.misuse_streak;
  let flagged = existing.flagged_for_review;

  if (cmp.outcome === "match") {
    misuseStreak = 0;
    // Quietly absorb route/road coverage from honest partial drives
    const merged = mergeSnapshots(existing.snapshot, {
      ...observed,
      // don't add unknown addresses on silent match
      addressKeys: observed.addressKeys.filter((k) =>
        existing.snapshot.addressKeys.includes(k)
      ),
      addresses: observed.addresses.filter((_, i) =>
        existing.snapshot.addressKeys.includes(observed.addressKeys[i])
      ),
    });
    await updateFingerprint(existing.id, merged, {
      sampleCountInc: 1,
      misuseStreak: 0,
    });
  } else if (cmp.outcome === "small_expansion") {
    // Honest growth — reset streak; wait for optional confirm before expanding
    misuseStreak = 0;
    await updateFingerprint(existing.id, existing.snapshot, {
      misuseStreak: 0,
    });
  } else if (cmp.outcome === "large_difference") {
    // Soft anti-abuse: count unresolved unrelated drives; never block or suspend
    misuseStreak += 1;
    if (misuseStreak >= MISUSE_STREAK_TO_FLAG) {
      flagged = true;
      await updateFingerprint(existing.id, existing.snapshot, {
        misuseStreak,
        flaggedForReview: true,
        reviewNote: `Several drives look unrelated to ${communityName}. Soft flag for manual review only — inspection still saved, no account action.`,
      });
    } else {
      await updateFingerprint(existing.id, existing.snapshot, {
        misuseStreak,
      });
    }
  }

  // Optional prompts only; large diffs are dismissible and never lock anyone out
  const needsUserAction =
    cmp.outcome === "small_expansion" || cmp.outcome === "large_difference";

  const eventId = await insertEvent({
    fingerprint_id: existing.id,
    company_id: signal.companyId,
    user_id: signal.userId,
    community_key: communityKey,
    inspection_id: signal.inspectionId,
    outcome: cmp.outcome,
    match_ratio: cmp.matchRatio,
    known_count: cmp.knownCount,
    new_count: cmp.newCount,
    missing_count: cmp.missingCount,
    new_addresses: cmp.newAddresses,
    observed_addresses: observed.addresses,
    observed_roads: observed.roadsCovered,
    geo_lat: observed.centroidLat,
    geo_lng: observed.centroidLng,
    route_points: observed.routePoints,
    flagged_for_review: flagged && cmp.outcome === "large_difference",
    helpful_message: helpfulMessageFor(
      cmp.outcome,
      communityName,
      cmp.newCount
    ),
    metadata: {
      misuseStreak,
      roads: observed.roadsCovered,
      entrances: observed.entrances,
      softOnly: true,
    },
  });

  return {
    outcome: cmp.outcome,
    eventId,
    fingerprintId: existing.id,
    matchRatio: cmp.matchRatio,
    knownCount: cmp.knownCount,
    newCount: cmp.newCount,
    missingCount: cmp.missingCount,
    newAddresses: cmp.newAddresses,
    observedAddresses: observed.addresses,
    observedRoads: observed.roadsCovered,
    helpfulMessage: helpfulMessageFor(
      cmp.outcome,
      communityName,
      cmp.newCount
    ),
    needsUserAction,
    flaggedForReview: flagged && cmp.outcome === "large_difference",
    communityName,
  };
}

/**
 * Apply inspector choice from soft verification UX.
 */
export async function resolveCommunityVerification(opts: {
  eventId: string;
  userId: string;
  resolution: VerificationResolution;
  communityName?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  if (!isCommunityVerificationEnabled()) {
    return { ok: true, message: "Thanks — nothing else needed." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database not configured" };

  const { data: event, error } = await admin
    .from("community_verification_events")
    .select("*")
    .eq("id", opts.eventId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return { ok: true, message: "Thanks — your inspection is already saved." };
    }
    return { ok: false, error: "Verification event not found" };
  }
  if (!event) {
    return { ok: false, error: "Verification event not found" };
  }
  if (event.user_id && event.user_id !== opts.userId) {
    return { ok: false, error: "Not allowed" };
  }

  const fingerprintId = event.fingerprint_id as string | null;
  const observedAddresses = (event.observed_addresses as string[]) ?? [];
  const newAddresses = (event.new_addresses as string[]) ?? [];
  const routePoints = (event.route_points as GeoPoint[]) ?? [];
  const geo =
    event.geo_lat != null && event.geo_lng != null
      ? { lat: Number(event.geo_lat), lng: Number(event.geo_lng) }
      : null;

  let outcome: VerificationOutcome = event.outcome as VerificationOutcome;
  let message = "Saved.";

  if (
    opts.resolution === "confirm_new_homes" ||
    opts.resolution === "expand_fingerprint"
  ) {
    if (!fingerprintId) {
      return { ok: false, error: "No community fingerprint to update" };
    }
    const { data: fp } = await admin
      .from("community_fingerprints")
      .select("*")
      .eq("id", fingerprintId)
      .maybeSingle();
    if (!fp) return { ok: false, error: "Fingerprint missing" };

    const base = rowToSnapshot(fp);
    const add = buildSnapshotFromObservation(
      opts.resolution === "confirm_new_homes"
        ? [...base.addresses, ...newAddresses]
        : observedAddresses,
      geo,
      routePoints
    );
    const merged = mergeSnapshots(base, add);
    await updateFingerprint(fingerprintId, merged, {
      sampleCountInc: 1,
      misuseStreak: 0,
      flaggedForReview: false,
      reviewNote: null,
    });
    outcome =
      opts.resolution === "confirm_new_homes" ? "expanded" : "expanded";
    message =
      opts.resolution === "confirm_new_homes"
        ? "Thanks — those homes are now part of this community’s map."
        : "Community map updated. Your inspection was already saved.";
  } else if (opts.resolution === "ignore_new_homes") {
    outcome = "ignored_new";
    message = "Got it — we’ll keep the existing community map as-is.";
    if (fingerprintId) {
      const { data: fpIgnore } = await admin
        .from("community_fingerprints")
        .select("*")
        .eq("id", fingerprintId)
        .maybeSingle();
      if (fpIgnore) {
        await updateFingerprint(fingerprintId, rowToSnapshot(fpIgnore), {
          misuseStreak: 0,
        });
      }
    }
  } else if (opts.resolution === "create_new_community") {
    outcome = "new_community_suggested";
    message =
      "No problem. This inspection stays saved — add another community under Pricing whenever you’re ready. Nothing is locked or charged from this tip.";
    if (fingerprintId) {
      const { data: fp } = await admin
        .from("community_fingerprints")
        .select("*")
        .eq("id", fingerprintId)
        .maybeSingle();
      if (fp) {
        await updateFingerprint(fingerprintId, rowToSnapshot(fp), {
          misuseStreak: 0,
        });
      }
    }
  } else {
    message = "No problem — your inspection is saved.";
  }

  await admin
    .from("community_verification_events")
    .update({
      resolution: opts.resolution,
      resolution_at: new Date().toISOString(),
      outcome,
      helpful_message: message,
    })
    .eq("id", opts.eventId);

  return { ok: true, message };
}

export { communityDriveInstruction } from "@/lib/community-drive-copy";
