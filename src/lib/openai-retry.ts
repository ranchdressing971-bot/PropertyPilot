import { getOpenAI } from "./openai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Allow a few overlapping OpenAI calls (faster), but space starts so
 * free-tier TPM doesn't spike like a full Promise.all burst.
 */
const MAX_IN_FLIGHT = 2;
const MIN_START_GAP_MS = 350;

let inFlight = 0;
let lastStartAt = 0;
const waiters: Array<() => void> = [];

function wakeNext() {
  while (waiters.length > 0 && inFlight < MAX_IN_FLIGHT) {
    const next = waiters.shift();
    next?.();
  }
}

/** Acquire a slot; resolves when a call may start. */
async function acquireOpenAISlot(): Promise<void> {
  await new Promise<void>((resolve) => {
    const tryStart = () => {
      if (inFlight >= MAX_IN_FLIGHT) {
        waiters.push(tryStart);
        return;
      }
      const gap = Math.max(0, MIN_START_GAP_MS - (Date.now() - lastStartAt));
      if (gap > 0) {
        setTimeout(tryStart, gap);
        return;
      }
      inFlight += 1;
      lastStartAt = Date.now();
      resolve();
    };
    tryStart();
  });
}

function releaseOpenAISlot() {
  inFlight = Math.max(0, inFlight - 1);
  wakeNext();
}

/**
 * Run async work over items with limited concurrency (e.g. 2 frame batches at once).
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
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

  const msg = e.message || "";
  const secMatch = msg.match(/try again in ([\d.]+)\s*s/i);
  if (secMatch) {
    return Math.min(Math.ceil(parseFloat(secMatch[1]) * 1000) + 500, 60_000);
  }

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
    await acquireOpenAISlot();
    try {
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
    } finally {
      releaseOpenAISlot();
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
