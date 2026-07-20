/** HOA trash pickup schedule — bins are only a violation on non-collection days. */

export type Weekday =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export const WEEKDAYS: { id: Weekday; label: string; short: string }[] = [
  { id: "sun", label: "Sunday", short: "Sun" },
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
];

/** Default: typical midweek + Friday pickup — bins flagged other days. */
export const DEFAULT_COLLECTION_DAYS: Weekday[] = ["tue", "fri"];

export const COLLECTION_DAYS_KEY = "pp-trash-collection-days";

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function weekdayFromDate(date: Date = new Date()): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function isCollectionDay(
  days: Weekday[],
  date: Date = new Date()
): boolean {
  if (!days.length) return false;
  return days.includes(weekdayFromDate(date));
}

export function formatCollectionDays(days: Weekday[]): string {
  if (!days.length) return "Not set";
  const order = WEEKDAYS.map((d) => d.id);
  return [...days]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((id) => WEEKDAYS.find((d) => d.id === id)?.short ?? id)
    .join(", ");
}

export function loadCollectionDays(): Weekday[] {
  if (typeof window === "undefined") return DEFAULT_COLLECTION_DAYS;
  try {
    const raw = localStorage.getItem(COLLECTION_DAYS_KEY);
    if (!raw) return DEFAULT_COLLECTION_DAYS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((d): d is Weekday =>
      WEEKDAYS.some((w) => w.id === d)
    );
    return valid.length ? valid : DEFAULT_COLLECTION_DAYS;
  } catch {
    return DEFAULT_COLLECTION_DAYS;
  }
}

export function saveCollectionDays(days: Weekday[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLLECTION_DAYS_KEY, JSON.stringify(days));
}

/** Drop trash-bin flags when the scan day is a scheduled pickup day. */
export function shouldEnforceTrashBins(
  collectionDays: Weekday[],
  scanDate: Date = new Date()
): boolean {
  // No schedule configured → keep old behavior (always flag visible bins)
  if (!collectionDays.length) return true;
  return !isCollectionDay(collectionDays, scanDate);
}
