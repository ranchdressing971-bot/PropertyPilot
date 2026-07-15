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

/**
 * Dev / demo names must NOT lock a global free-trial bucket.
 * "Test HOA" → key "test"; real HOAs still first-account-wins.
 */
export function isSandboxCommunityKey(hoaNameOrKey: string): boolean {
  const key = normalizeCommunityKey(hoaNameOrKey);
  if (!key) return false;
  const exact = new Set([
    "test",
    "testing",
    "demo",
    "sandbox",
    "sample",
    "example",
    "playground",
    "dev",
    "local",
  ]);
  if (exact.has(key)) return true;
  return /^(test|testing|demo|sandbox|sample|example|playground|dev|local)\d*$/.test(
    key
  );
}

export function isValidCommunityName(hoaName: string): boolean {
  const trimmed = hoaName.trim();
  if (trimmed.length < 3) return false;
  const key = normalizeCommunityKey(trimmed);
  // Too generic after stripping suffixes
  if (key.length < 3) return false;
  // Only block empty/placeholder junk — sandbox names like "Test HOA" are allowed
  const blocked = new Set(["none", "na", "n/a", "yourcommunity", "myhoa", "hoa"]);
  return !blocked.has(key);
}
