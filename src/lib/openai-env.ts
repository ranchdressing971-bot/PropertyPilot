/** Normalize OPENAI_API_KEY — Vercel paste often adds quotes or trailing newlines. */
export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }
  return trimmed;
}
