import { format, parseISO, isValid } from "date-fns";

export function formatDate(value: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  const date = value.length <= 10 ? parseISO(`${value}T12:00:00`) : parseISO(value);
  if (!isValid(date)) return "—";
  return format(date, pattern);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, "h:mm a");
}

export function formatDateTime(
  date: string | null | undefined,
  time: string | null | undefined
): string {
  if (!date) return "—";
  if (!time) return formatDate(date);
  return `${formatDate(date)} · ${formatTime(time)}`;
}

export function formatAddress(parts: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
}): string {
  const line = [parts.line1, parts.line2].filter(Boolean).join(", ");
  const cityLine = [parts.city, parts.state].filter(Boolean).join(", ");
  const withZip = [cityLine, parts.postal].filter(Boolean).join(" ");
  return [line, withZip].filter(Boolean).join(" · ") || "No address";
}

export function titleCaseStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
