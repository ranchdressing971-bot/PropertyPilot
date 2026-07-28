/**
 * Send-window policy for the future Outreach send hand.
 *
 * Isaac's target pace: one email every 5–15 minutes (randomized so it looks
 * human), 10:00–15:00 local time. Soft throughput ~20–60/day depending on
 * rolls — keep the hard daily cap so a bug can't spray.
 *
 * Nothing here sends yet. These constants exist so the send hand and scheduler
 * share one source of truth when the Gmail path lands.
 */

export const OUTREACH_TZ = "America/New_York";

/** Local hour to start sending (inclusive). 10 = 10:00am. */
export const OUTREACH_WINDOW_START_HOUR = 10;

/** Local hour to stop sending (exclusive). 15 = 3:00pm. */
export const OUTREACH_WINDOW_END_HOUR = 15;

/** Shortest gap between sends (minutes). */
export const OUTREACH_SEND_INTERVAL_MIN_MINUTES = 5;

/** Longest gap between sends (minutes). */
export const OUTREACH_SEND_INTERVAL_MAX_MINUTES = 15;

/**
 * @deprecated Prefer min/max + nextOutreachSendDelayMs. Kept so older call sites
 * that assumed a fixed 15-minute gap still compile.
 */
export const OUTREACH_SEND_INTERVAL_MINUTES = OUTREACH_SEND_INTERVAL_MAX_MINUTES;

/** Hard daily ceiling, even inside the window (~5hr × jitter ≈ 20–60 theoretical). */
export const OUTREACH_MAX_SENDS_PER_DAY = 30;

/**
 * AI review confidence needed to auto-approve a draft for the send queue.
 * Below this, the draft is rejected rather than left for a human — outreach
 * runs unattended by design.
 */
export const OUTREACH_AUTO_APPROVE_MIN_SCORE = 75;

/**
 * Random delay until the next send, inclusive of min/max minutes.
 * Call once after each successful send (or when scheduling the next job).
 */
export function nextOutreachSendDelayMs(
  random: () => number = Math.random
): number {
  const min = OUTREACH_SEND_INTERVAL_MIN_MINUTES;
  const max = OUTREACH_SEND_INTERVAL_MAX_MINUTES;
  const minutes = min + random() * (max - min);
  return Math.round(minutes * 60_000);
}
