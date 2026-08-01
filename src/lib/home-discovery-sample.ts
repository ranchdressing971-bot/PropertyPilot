import { BLANK_CONTENT_THRESHOLD } from "./video-frames";

/** Max images sent in one home-discovery vision call (cost cap). */
export const HOME_DISCOVERY_MAX_IMAGES = 12;

/**
 * Evenly spaced indices across [0, length) — avoids stride filters that drop
 * every other house frame (e.g. i % 2 === 0 on a 14-frame drive).
 */
export function evenSpreadIndices(length: number, max: number): number[] {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, i) => i);

  const out: number[] = [];
  const used = new Set<number>();
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (length - 1)) / (max - 1));
    if (!used.has(idx)) {
      used.add(idx);
      out.push(idx);
    }
  }
  return out;
}

/**
 * Choose source-frame indices for home-discovery.
 * Prefers contentful frames when scores are available, then even temporal spread.
 * Returned indices always refer to the original frame list.
 */
export function pickHomeDiscoveryIndices(
  frameCount: number,
  contentScores?: Array<number | undefined>,
  max = HOME_DISCOVERY_MAX_IMAGES
): number[] {
  if (frameCount <= 0) return [];

  let pool = Array.from({ length: frameCount }, (_, i) => i);

  if (contentScores && contentScores.length === frameCount) {
    const contentful = pool.filter(
      (i) => (contentScores[i] ?? 0) >= BLANK_CONTENT_THRESHOLD
    );
    // Only prefer contentful when we still have enough distinct homes to find
    if (contentful.length >= 3) pool = contentful;
  }

  if (pool.length <= max) return pool;

  // Spread across the contentful pool (indices into original frames)
  return evenSpreadIndices(pool.length, max).map((i) => pool[i]);
}
