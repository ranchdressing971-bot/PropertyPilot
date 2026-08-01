import { OUTREACH_TZ } from "@/lib/nexus/outreach-policy";

/** Ops / Nova default clock — Eastern unless a profile TZ is wired later. */
export const NOVA_TZ = OUTREACH_TZ;

export type NovaClockSnapshot = {
  timeZone: string;
  isoUtc: string;
  isoLocal: string;
  weekday: string;
  date: string;
  time: string;
  timeWithZone: string;
};

/**
 * Fresh wall-clock for Nova's context. Call per request — never cache at boot.
 */
export function getNovaClock(now: Date = new Date()): NovaClockSnapshot {
  const timeZone = NOVA_TZ;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  const timeWithZone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now);

  // en-CA gives YYYY-MM-DD in most engines for this zone.
  const isoLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(", ", "T");

  return {
    timeZone,
    isoUtc: now.toISOString(),
    isoLocal,
    weekday,
    date,
    time,
    timeWithZone,
  };
}

/** System-prompt block — regenerated on every chat / status call. */
export function novaClockContextBlock(now: Date = new Date()): string {
  const c = getNovaClock(now);
  return [
    "Current date & time (authoritative — answer “what time is it” from this, not memory):",
    `- timezone: ${c.timeZone}`,
    `- local: ${c.weekday}, ${c.date}, ${c.timeWithZone}`,
    `- localISO: ${c.isoLocal}`,
    `- utcISO: ${c.isoUtc}`,
    "- This is live wall-clock for this request. Outreach send-window rails are separate settings, not “the correct time to work.”",
  ].join("\n");
}
