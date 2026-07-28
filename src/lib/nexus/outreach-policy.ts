/**
 * Send-window policy for the future Outreach send hand.
 *
 * Isaac's target pace: one email every 15 minutes, 10:00–15:00 local time.
 * That caps natural throughput at ~20/day without a separate daily counter —
 * still add an explicit daily cap so a bug can't blow past the window math.
 *
 * Nothing here sends yet. These constants exist so the send hand and scheduler
 * share one source of truth when the Gmail path lands.
 */

export const OUTREACH_TZ = "America/New_York";

/** Local hour to start sending (inclusive). 10 = 10:00am. */
export const OUTREACH_WINDOW_START_HOUR = 10;

/** Local hour to stop sending (exclusive). 15 = 3:00pm. */
export const OUTREACH_WINDOW_END_HOUR = 15;

/** Minimum minutes between sends. */
export const OUTREACH_SEND_INTERVAL_MINUTES = 15;

/** Hard daily ceiling, even inside the window. */
export const OUTREACH_MAX_SENDS_PER_DAY = 20;

/**
 * AI review confidence needed to auto-approve a draft for the send queue.
 * Below this, the draft is rejected rather than left for a human — outreach
 * runs unattended by design.
 */
export const OUTREACH_AUTO_APPROVE_MIN_SCORE = 75;
