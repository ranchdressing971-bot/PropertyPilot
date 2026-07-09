/**
 * Normalize HOA / community names so "Willow Creek HOA" and "willow creek"
 * map to the same trial bucket.
 */
export function normalizeCommunityKey(hoaName: string): string {
  return hoaName
    .trim()
    .toLowerCase()
    .replace(/\b(hoa|homeowners?\s+association|association|community|village|estates?)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 64);
}

export function isValidCommunityName(hoaName: string): boolean {
  const trimmed = hoaName.trim();
  if (trimmed.length < 3) return false;
  const key = normalizeCommunityKey(trimmed);
  // Too generic after stripping suffixes
  if (key.length < 3) return false;
  const blocked = new Set([
    "test",
    "testing",
    "demo",
    "asdf",
    "none",
    "na",
    "yourcommunity",
    "myhoa",
    "hoa",
  ]);
  return !blocked.has(key);
}
