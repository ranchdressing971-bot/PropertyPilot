import { getOpenAI } from "./openai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: { code?: string; type?: string };
  };
  const code = e.code || e.error?.code || "";
  const msg = (e.message || "").toLowerCase();
  return (
    e.status === 429 ||
    code === "rate_limit_exceeded" ||
    msg.includes("rate limit") ||
    msg.includes("429")
  );
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    message?: string;
    error?: { code?: string };
  };
  const code = e.code || e.error?.code || "";
  const msg = (e.message || "").toLowerCase();
  return (
    code === "insufficient_quota" ||
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota")
  );
}

/**
 * Call OpenAI with retries on 429 rate limits (not quota exhaustion).
 * New accounts have tiny TPM — vision bursts hit this even at $0.04 spend.
 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; label?: string }
): Promise<T> {
  const retries = opts?.retries ?? 4;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err)) throw err;
      if (!isRateLimitError(err) || attempt === retries) throw err;

      const e = err as { headers?: { get?: (k: string) => string | null } };
      const retryAfterMs = Number(e.headers?.get?.("retry-after-ms") || 0);
      const retryAfterSec = Number(e.headers?.get?.("retry-after") || 0);
      const wait =
        retryAfterMs > 0
          ? retryAfterMs
          : retryAfterSec > 0
            ? retryAfterSec * 1000
            : 2000 * Math.pow(2, attempt);
      console.warn(
        `OpenAI rate limit${opts?.label ? ` (${opts.label})` : ""} — retry ${attempt + 1}/${retries} in ${Math.round(wait)}ms`
      );
      await sleep(Math.min(wait, 30_000));
    }
  }

  throw lastErr;
}

export async function createChatCompletion(
  params: Parameters<
    ReturnType<typeof getOpenAI>["chat"]["completions"]["create"]
  >[0],
  label?: string
) {
  return withOpenAIRetry(
    () => getOpenAI().chat.completions.create(params),
    { label }
  );
}

export { isRateLimitError, isQuotaError, sleep };
