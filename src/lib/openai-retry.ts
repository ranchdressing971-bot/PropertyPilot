import { getOpenAI } from "./openai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Min gap between OpenAI calls — prevents TPM spikes on free/low tiers. */
const MIN_GAP_MS = 900;
let lastCallAt = 0;
let queue: Promise<void> = Promise.resolve();

/**
 * Serialize OpenAI calls with a minimum gap so parallel pipelines
 * don't dump 10+ vision requests into the same second.
 */
async function throttleOpenAI(): Promise<void> {
  const run = queue.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  });
  // Don't let one failure block the whole queue
  queue = run.catch(() => undefined);
  await run;
}

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
    msg.includes("tokens per min") ||
    msg.includes("requests per min") ||
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
    msg.includes("exceeded your current quota") ||
    msg.includes("billing hard limit")
  );
}

function retryWaitMs(err: unknown, attempt: number): number {
  const e = err as {
    headers?: { get?: (k: string) => string | null };
    message?: string;
  };
  const retryAfterMs = Number(e.headers?.get?.("retry-after-ms") || 0);
  if (retryAfterMs > 0) return Math.min(retryAfterMs + 250, 60_000);

  const retryAfterSec = Number(e.headers?.get?.("retry-after") || 0);
  if (retryAfterSec > 0) return Math.min(retryAfterSec * 1000 + 250, 60_000);

  // OpenAI often embeds "Please try again in 20.5s"
  const msg = e.message || "";
  const secMatch = msg.match(/try again in ([\d.]+)\s*s/i);
  if (secMatch) {
    return Math.min(Math.ceil(parseFloat(secMatch[1]) * 1000) + 500, 60_000);
  }

  // TPM resets on a rolling minute — back off harder than 2s * 2^n
  return Math.min(4000 * Math.pow(2, attempt), 45_000);
}

/**
 * Call OpenAI with retries on 429 rate limits (not quota exhaustion).
 * New accounts have tiny TPM — vision bursts hit this even at $0.04 spend.
 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; label?: string }
): Promise<T> {
  const retries = opts?.retries ?? 5;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttleOpenAI();
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err)) throw err;
      if (!isRateLimitError(err) || attempt === retries) throw err;

      const wait = retryWaitMs(err, attempt);
      console.warn(
        `OpenAI rate limit${opts?.label ? ` (${opts.label})` : ""} — retry ${attempt + 1}/${retries} in ${Math.round(wait)}ms`
      );
      await sleep(wait);
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
