import type { Property } from "./mock-data";

export const ROSTER_STORAGE_KEY = "pp-property-roster";

export function parseCsvRoster(csv: string, neighborhood = "Your Community"): Property[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("address") || first.includes("street");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, i) => {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
      c.replace(/^"|"$/g, "").trim()
    );
    const address = cols[0] || `Property ${i + 1}`;
    const lot = cols[1] || undefined;

    return {
      id: `prop-${i + 1}`,
      address: lot ? `${address} (Lot ${lot})` : address,
      image: "",
      status: "Good Standing" as const,
      lastInspection: "—",
      neighborhood,
    };
  });
}

export function rosterFromStorage(): Property[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Property[]) : [];
  } catch {
    return [];
  }
}

export function saveRosterToStorage(properties: Property[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(properties));
}

export function normalizeRosterIds(properties: Property[]): Property[] {
  return properties.map((p, i) => ({
    ...p,
    id: p.id || `prop-${i + 1}`,
  }));
}
