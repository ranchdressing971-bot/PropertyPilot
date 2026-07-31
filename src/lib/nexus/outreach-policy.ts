/**
 * Send-window policy for the Outreach send hand (Mailtrap now, Gmail later).
 *
 * Pace: one email every 5–15 minutes (randomized), 10:00–15:00 America/New_York.
 * Hard daily cap so jitter never turns into a spray.
 * Kill switch: NEXUS_SEND_ENABLED must be exactly "true".
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
 * @deprecated Prefer min/max + nextOutreachSendDelayMs.
 */
export const OUTREACH_SEND_INTERVAL_MINUTES = OUTREACH_SEND_INTERVAL_MAX_MINUTES;

/** Hard daily ceiling, even inside the window. */
export const OUTREACH_MAX_SENDS_PER_DAY = 30;

/**
 * AI review confidence needed to auto-approve a draft for the send queue.
 */
export const OUTREACH_AUTO_APPROVE_MIN_SCORE = 75;

/** Master kill switch — off unless explicitly enabled. */
export function isNexusSendEnabled(): boolean {
  return (process.env.NEXUS_SEND_ENABLED ?? "").trim().toLowerCase() === "true";
}

function etParts(date = new Date()): {
  hour: number;
  minute: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OUTREACH_TZ,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour: hour === 24 ? 0 : hour, minute, weekday: map[wd] ?? 1 };
}

/** True when local ET time is inside the send window (weekdays only). */
export function isWithinOutreachWindow(date = new Date()): boolean {
  const { hour, weekday } = etParts(date);
  if (weekday === 0 || weekday === 6) return false;
  return hour >= OUTREACH_WINDOW_START_HOUR && hour < OUTREACH_WINDOW_END_HOUR;
}

/**
 * Seconds until the next window open. If nextDay, jump to tomorrow 10:00 ET
 * even when still inside today's window (used after daily cap).
 */
export function secondsUntilOutreachWindow(nextDay = false): number {
  const now = new Date();
  if (!nextDay && isWithinOutreachWindow(now)) return 0;

  // Probe forward in 15-minute steps up to 8 days — simple and TZ-safe enough.
  for (let step = 1; step <= 8 * 24 * 4; step++) {
    const probe = new Date(now.getTime() + step * 15 * 60_000);
    if (isWithinOutreachWindow(probe)) {
      const { minute } = etParts(probe);
      // Align to top of hour when we land mid-slot near open
      const adjust =
        etParts(probe).hour === OUTREACH_WINDOW_START_HOUR && minute > 0
          ? -minute * 60
          : 0;
      return Math.max(60, step * 15 * 60 + adjust);
    }
  }
  return 12 * 3600;
}

/**
 * Random delay until the next send, inclusive of min/max minutes.
 */
export function nextOutreachSendDelayMs(
  random: () => number = Math.random
): number {
  const min = OUTREACH_SEND_INTERVAL_MIN_MINUTES;
  const max = OUTREACH_SEND_INTERVAL_MAX_MINUTES;
  const minutes = min + random() * (max - min);
  return Math.round(minutes * 60_000);
}

export function nextOutreachSendDelaySeconds(
  random: () => number = Math.random
): number {
  return Math.max(1, Math.round(nextOutreachSendDelayMs(random) / 1000));
}
