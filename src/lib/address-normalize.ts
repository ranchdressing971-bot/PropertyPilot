/**
 * Normalize and dedupe street addresses from video OCR.
 */

const STREET_SUFFIXES =
  /\b(street|st|lane|ln|drive|dr|road|rd|avenue|ave|court|ct|boulevard|blvd|way|circle|cir|place|pl|terrace|ter|trail|trl)\b/gi;

export function isPlaceholderAddress(address: string): boolean {
  return /^Home at \d+:\d+$/i.test(address.trim()) || /^Property at /i.test(address.trim());
}

export function extractHouseNumber(address: string): string | null {
  const match = address.trim().match(/^(\d+[a-z]?)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Core street name without suffix noise — used for dedupe keys. */
export function streetCore(address: string): string {
  const withoutNumber = address
    .trim()
    .replace(/^\d+[a-z]?\s*/i, "")
    .replace(STREET_SUFFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return withoutNumber.slice(0, 24);
}

/** Stable key for merging "123 Oak Ln" with "123 Oak Lane". */
export function addressDedupeKey(address: string): string {
  const trimmed = address.trim();
  if (isPlaceholderAddress(trimmed)) return `placeholder-${trimmed.toLowerCase()}`;

  const number = extractHouseNumber(trimmed);
  const street = streetCore(trimmed);

  if (number && street) return `${number}|${street}`;
  if (number) return `num|${number}`;
  return `text|${trimmed.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

/** Prefer the most complete readable address. */
export function pickBetterAddress(a: string, b: string): string {
  const score = (addr: string) => {
    if (isPlaceholderAddress(addr)) return 0;
    let s = addr.length;
    if (/\d/.test(addr)) s += 20;
    if (STREET_SUFFIXES.test(addr)) s += 15;
    if (addr.split(/\s+/).length >= 3) s += 10;
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

export function addressesLikelySame(a: string, b: string): boolean {
  const keyA = addressDedupeKey(a);
  const keyB = addressDedupeKey(b);
  if (keyA === keyB) return true;

  const numA = extractHouseNumber(a);
  const numB = extractHouseNumber(b);
  if (!numA || !numB || numA !== numB) return false;

  const streetA = streetCore(a);
  const streetB = streetCore(b);
  if (!streetA || !streetB) return true;

  if (streetA === streetB) return true;
  if (streetA.includes(streetB) || streetB.includes(streetA)) return true;

  const minLen = Math.min(streetA.length, streetB.length);
  if (minLen >= 4 && streetA.slice(0, minLen) === streetB.slice(0, minLen)) return true;

  return false;
}

export function formatAddressTitle(address: string): string {
  const trimmed = address.trim();
  if (isPlaceholderAddress(trimmed)) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0 && /^\d+[a-z]?$/i.test(word)) return word;
      if (STREET_SUFFIXES.test(word)) {
        const map: Record<string, string> = {
          st: "St",
          street: "Street",
          ln: "Ln",
          lane: "Lane",
          dr: "Dr",
          drive: "Drive",
          rd: "Rd",
          road: "Road",
          ave: "Ave",
          avenue: "Avenue",
          ct: "Ct",
          court: "Court",
          blvd: "Blvd",
          boulevard: "Boulevard",
          way: "Way",
          cir: "Cir",
          circle: "Circle",
          pl: "Pl",
          place: "Place",
        };
        const lower = word.toLowerCase();
        return map[lower] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
