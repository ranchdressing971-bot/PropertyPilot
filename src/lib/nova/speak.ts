/**
 * Server TTS for Nova voice replies.
 *
 * Fallback chain (first configured + working wins):
 *   1. ElevenLabs — user's ELEVENLABS_VOICE_ID when credits work
 *   2. Google Cloud TTS — real en-GB neural female (British when ElevenLabs is dry)
 *   3. OpenAI TTS — female / natural last resort (NOT British; stock voices
 *      cannot do a convincing British woman — only `fable` is British, and male)
 *
 * Required for iPhone autoplay (WebKit speechSynthesis cannot start after
 * await fetch).
 */

import { getOpenAIApiKey } from "@/lib/openai-env";

/** Premade Lily — used only when ELEVENLABS_VOICE_ID / _NAME are unset. */
export const DEFAULT_ELEVENLABS_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
const DEFAULT_ELEVENLABS_VOICE_NAMES = ["Lily", "Alice", "Nova"] as const;

/** Google Neural2 British female — clear adult woman, not theatrical. */
export const DEFAULT_GOOGLE_TTS_VOICE = "en-GB-Neural2-A";

/** OpenAI voices that sound male/deep — never use these for Nova fallback. */
const OPENAI_DEEP_VOICES = new Set(["fable", "onyx", "echo"]);

let cachedVoiceId: string | null = null;

export type NovaVoiceProvider = "elevenlabs" | "google" | "openai";
export type NovaSpeechFormat = "mpeg" | "wav";

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function isGoogleTtsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TTS_API_KEY?.trim());
}

export function isOpenAITtsConfigured(): boolean {
  return Boolean(getOpenAIApiKey());
}

/** True when at least one server TTS provider can return audio bytes. */
export function isServerTtsConfigured(): boolean {
  return (
    isElevenLabsConfigured() ||
    isGoogleTtsConfigured() ||
    isOpenAITtsConfigured()
  );
}

export function preferredNovaVoiceProvider(): NovaVoiceProvider | null {
  if (isElevenLabsConfigured()) return "elevenlabs";
  if (isGoogleTtsConfigured()) return "google";
  if (isOpenAITtsConfigured()) return "openai";
  return null;
}

function hasBritishServerFallback(): boolean {
  return isGoogleTtsConfigured();
}

type ElVoice = { voice_id: string; name: string; category?: string };

async function listAccountVoices(apiKey: string): Promise<ElVoice[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `ElevenLabs voices list failed (${response.status}): ${detail.slice(0, 200)}`
    );
  }
  const data = (await response.json()) as { voices?: ElVoice[] };
  return data.voices ?? [];
}

/** Voice IDs look like 20+ char alphanumeric; names are short words. */
function looksLikeVoiceId(value: string): boolean {
  return /^[a-zA-Z0-9]{16,}$/.test(value);
}

function findByName(voices: ElVoice[], name: string): ElVoice | undefined {
  const want = name.trim().toLowerCase();
  return (
    voices.find((v) => v.name.trim().toLowerCase() === want) ??
    voices.find((v) => v.name.trim().toLowerCase().includes(want))
  );
}

/**
 * Resolve a voice the API key is allowed to use.
 * Honors ELEVENLABS_VOICE_ID / ELEVENLABS_VOICE_NAME when set.
 * Prefers premade Lily only when env does not override.
 */
export async function resolveElevenLabsVoiceId(apiKey: string): Promise<string> {
  if (cachedVoiceId) return cachedVoiceId;

  const rawId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const rawName = process.env.ELEVENLABS_VOICE_NAME?.trim();

  // Exact voice id from env — use directly (never replace with Lily default).
  if (rawId && looksLikeVoiceId(rawId)) {
    cachedVoiceId = rawId;
    return cachedVoiceId;
  }

  // No override: default to premade Lily (British female).
  if (!rawId && !rawName) {
    cachedVoiceId = DEFAULT_ELEVENLABS_VOICE_ID;
    return cachedVoiceId;
  }

  const voices = await listAccountVoices(apiKey);
  if (voices.length === 0) {
    throw new Error(
      "No ElevenLabs voices on this account. Create/clone one in My Voices, then set ELEVENLABS_VOICE_ID (the id, not the name)."
    );
  }

  // Env was a name like "Nova" put in VOICE_ID by mistake — resolve by name.
  const nameHint =
    rawName || (rawId && !looksLikeVoiceId(rawId) ? rawId : "");
  if (nameHint) {
    const byName = findByName(voices, nameHint);
    if (byName) {
      cachedVoiceId = byName.voice_id;
      return cachedVoiceId;
    }
  }

  if (rawId && !looksLikeVoiceId(rawId)) {
    const available = voices.map((v) => v.name).slice(0, 8).join(", ");
    throw new Error(
      `No voice named "${rawId}" on this ElevenLabs account. Available: ${available}. Set ELEVENLABS_VOICE_ID to the voice ID (⋯ → Copy voice ID), not the display name.`
    );
  }

  for (const name of DEFAULT_ELEVENLABS_VOICE_NAMES) {
    const match = findByName(voices, name);
    if (match) {
      cachedVoiceId = match.voice_id;
      return cachedVoiceId;
    }
  }

  const byDefaultId = voices.find(
    (v) => v.voice_id === DEFAULT_ELEVENLABS_VOICE_ID
  );
  if (byDefaultId) {
    cachedVoiceId = byDefaultId.voice_id;
    return cachedVoiceId;
  }

  const preferred =
    voices.find((v) =>
      /^(premade|cloned|generated|professional)$/i.test(v.category ?? "")
    ) ?? voices[0];

  cachedVoiceId = preferred.voice_id;
  return cachedVoiceId;
}

/** iPhone / iPad Safari — needs WAV for reliable HTMLAudioElement / AudioContext decode. */
export function isMobileSafariUserAgent(ua: string): boolean {
  if (!ua) return false;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ desktop UA
  return /Macintosh/i.test(ua) && /Mobile/i.test(ua);
}

function pcm16ToWav(pcm: Buffer, sampleRate = 44100): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function clipSpeechText(text: string): string {
  const clipped = text.trim().slice(0, 2500);
  if (!clipped) throw new Error("Nothing to speak");
  return clipped;
}

/** Clamp env speed into a sensible speaking-rate range. */
function parseSpeechSpeed(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function markQuotaError(message: string): Error {
  const err = new Error(message);
  (err as Error & { code?: string }).code = "QUOTA";
  return err;
}

function hasAnyLaterProvider(after: NovaVoiceProvider): boolean {
  if (after === "elevenlabs") {
    return isGoogleTtsConfigured() || isOpenAITtsConfigured();
  }
  if (after === "google") {
    return isOpenAITtsConfigured();
  }
  return false;
}

/**
 * ElevenLabs credit / billing / auth failures that should fall through to
 * the next provider immediately — not retry another ElevenLabs voice.
 */
export function isElevenLabsQuotaOrBillingFailure(
  status: number,
  detail: string
): boolean {
  const lower = detail.toLowerCase();
  if (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 429
  ) {
    return true;
  }
  return (
    lower.includes("quota") ||
    lower.includes("credit") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("payment") ||
    lower.includes("insufficient") ||
    lower.includes("billing") ||
    lower.includes("out of") ||
    lower.includes("usage_based") ||
    lower.includes("limit_exceeded") ||
    lower.includes("character limit") ||
    lower.includes("monthly limit")
  );
}

/** Premade / library voice blocked on free tier (not a credit exhaustion). */
function isPremadeVoiceBlocked(status: number, detail: string): boolean {
  const lower = detail.toLowerCase();
  // Do not treat credit exhaustion as "try another ElevenLabs voice".
  if (isElevenLabsQuotaOrBillingFailure(status, detail)) return false;
  return (
    status === 404 ||
    lower.includes("paying") ||
    lower.includes("library") ||
    lower.includes("voice_not_found") ||
    // "subscription" alone often appears in quota copy — only match with voice context.
    (lower.includes("subscription") &&
      (lower.includes("voice") ||
        lower.includes("library") ||
        lower.includes("premade") ||
        lower.includes("paying")))
  );
}

async function elevenLabsTtsRequest(
  apiKey: string,
  voiceId: string,
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<Response> {
  const model =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const wantWav = opts?.format === "wav";
  const outputFormat = wantWav ? "pcm_44100" : "mp3_44100_128";
  // Slightly brisker than default (1.0); ElevenLabs accepts ~0.7–1.2.
  const speed = parseSpeechSpeed(process.env.ELEVENLABS_SPEED, 1.15, 0.7, 1.2);

  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: wantWav ? "audio/pcm" : "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          // Higher stability = less theatrical / cartoon expressiveness.
          stability: 0.55,
          similarity_boost: 0.75,
          speed,
        },
      }),
    }
  );
}

/** When default Lily is blocked (free tier), pick Lily/Alice/Nova from My Voices. */
async function resolveAccountFallbackVoiceId(apiKey: string): Promise<string> {
  const voices = await listAccountVoices(apiKey);
  if (voices.length === 0) {
    throw new Error(
      "No ElevenLabs voices on this account. Create/clone a British female in My Voices, then set ELEVENLABS_VOICE_ID."
    );
  }
  for (const name of DEFAULT_ELEVENLABS_VOICE_NAMES) {
    const match = findByName(voices, name);
    if (match) return match.voice_id;
  }
  const preferred =
    voices.find((v) =>
      /^(premade|cloned|generated|professional)$/i.test(v.category ?? "")
    ) ?? voices[0];
  return preferred.voice_id;
}

function throwElevenLabsFailure(status: number, detail: string): never {
  const lower = detail.toLowerCase();
  cachedVoiceId = null;

  if (isElevenLabsQuotaOrBillingFailure(status, detail)) {
    throw markQuotaError(
      `ElevenLabs credits exhausted or rate-limited (${status}).`
    );
  }

  if (
    lower.includes("paying") ||
    lower.includes("library") ||
    (lower.includes("subscription") && lower.includes("voice"))
  ) {
    throw new Error(
      "That ElevenLabs voice needs a paid plan. Add a British female in My Voices and set ELEVENLABS_VOICE_ID (copy voice ID, not the name)."
    );
  }
  if (status === 404) {
    throw new Error(
      "ElevenLabs voice not found. Set ELEVENLABS_VOICE_ID to a real voice ID (⋯ → Copy voice ID), not a display name."
    );
  }
  throw new Error(`ElevenLabs failed (${status}): ${detail.slice(0, 300)}`);
}

async function synthesizeElevenLabs(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const clipped = clipSpeechText(text);
  const wantWav = opts?.format === "wav";
  const envVoiceSet = Boolean(
    process.env.ELEVENLABS_VOICE_ID?.trim() ||
      process.env.ELEVENLABS_VOICE_NAME?.trim()
  );
  let voiceId = await resolveElevenLabsVoiceId(apiKey);
  let response = await elevenLabsTtsRequest(apiKey, voiceId, clipped, opts);

  if (!response.ok) {
    const detail = await response.text();

    // Credits / quota / auth → stop ElevenLabs immediately (next-provider fallthrough).
    if (isElevenLabsQuotaOrBillingFailure(response.status, detail)) {
      console.warn(
        `[nova speak] ElevenLabs quota/billing failure (${response.status}):`,
        detail.slice(0, 240)
      );
      throwElevenLabsFailure(response.status, detail);
    }

    // Premade Lily may need a paid plan — try an account voice once.
    // Never do this when the user already set ELEVENLABS_VOICE_ID.
    if (
      !envVoiceSet &&
      voiceId === DEFAULT_ELEVENLABS_VOICE_ID &&
      isPremadeVoiceBlocked(response.status, detail)
    ) {
      console.warn(
        "[nova speak] Default Lily blocked; retrying with account voice:",
        detail.slice(0, 200)
      );
      cachedVoiceId = null;
      voiceId = await resolveAccountFallbackVoiceId(apiKey);
      cachedVoiceId = voiceId;
      response = await elevenLabsTtsRequest(apiKey, voiceId, clipped, opts);
      if (!response.ok) {
        const retryDetail = await response.text();
        console.warn(
          `[nova speak] ElevenLabs retry failed (${response.status}):`,
          retryDetail.slice(0, 240)
        );
        throwElevenLabsFailure(response.status, retryDetail);
      }
    } else {
      console.warn(
        `[nova speak] ElevenLabs TTS failed (${response.status}):`,
        detail.slice(0, 240)
      );
      throwElevenLabsFailure(response.status, detail);
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const raw = Buffer.from(arrayBuffer);

  if (wantWav) {
    return {
      audio: pcm16ToWav(raw, 44100),
      contentType: "audio/wav",
    };
  }

  return {
    audio: raw,
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}

/**
 * Google Cloud Text-to-Speech — genuine British female neural voice.
 * Uses REST + API key (no SDK). Enable Cloud Text-to-Speech API, then set
 * GOOGLE_TTS_API_KEY on Vercel. Default voice: en-GB-Neural2-A.
 */
async function synthesizeGoogle(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_TTS_API_KEY is not configured");
  }

  const clipped = clipSpeechText(text);
  const wantWav = opts?.format === "wav";
  const voiceName =
    process.env.GOOGLE_TTS_VOICE?.trim() || DEFAULT_GOOGLE_TTS_VOICE;
  // Google speakingRate 0.25–4.0; keep British woman ~1.15–1.2.
  const speakingRate = parseSpeechSpeed(
    process.env.GOOGLE_TTS_SPEED,
    1.18,
    0.25,
    4.0
  );
  const sampleRateHertz = 24000;

  const body = {
    input: { text: clipped },
    voice: {
      languageCode: "en-GB",
      name: voiceName,
      ssmlGender: "FEMALE" as const,
    },
    audioConfig: {
      audioEncoding: wantWav ? ("LINEAR16" as const) : ("MP3" as const),
      speakingRate,
      sampleRateHertz,
    },
  };

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const lower = detail.toLowerCase();
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("billing") ||
      lower.includes("permission") ||
      lower.includes("api key")
    ) {
      throw markQuotaError(
        `Google TTS unavailable (${response.status}). Check GOOGLE_TTS_API_KEY and that Cloud Text-to-Speech API is enabled.`
      );
    }
    throw new Error(
      `Google TTS failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error("Google TTS returned empty audioContent");
  }
  const raw = Buffer.from(data.audioContent, "base64");

  if (wantWav) {
    return {
      audio: pcm16ToWav(raw, sampleRateHertz),
      contentType: "audio/wav",
    };
  }

  return {
    audio: raw,
    contentType: "audio/mpeg",
  };
}

async function synthesizeOpenAI(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const clipped = clipSpeechText(text);
  const wantWav = opts?.format === "wav";
  // Last resort only. OpenAI has no convincing British female stock voice
  // (`fable` is British but male — user rejected). Do not fake an accent.
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  // Feminine: nova, shimmer, coral, sage. Avoid fable/onyx/echo (male/deep).
  const rawVoice = (process.env.OPENAI_TTS_VOICE?.trim() || "nova").toLowerCase();
  const voice = OPENAI_DEEP_VOICES.has(rawVoice) ? "nova" : rawVoice;
  const speed = parseSpeechSpeed(process.env.OPENAI_TTS_SPEED, 1.16, 0.25, 4.0);
  // Honest natural female — no British-accent prompt theater.
  const instructions =
    process.env.OPENAI_TTS_INSTRUCTIONS?.trim() ||
    "Adult woman. Natural conversational tone. Clear and warm. Not theatrical, not cartoonish.";

  const body: Record<string, unknown> = {
    model,
    voice,
    input: clipped,
    speed,
    response_format: wantWav ? "wav" : "mp3",
  };
  // Style instructions are only honored by gpt-4o-mini-tts (and similar).
  if (/gpt-4o.*tts/i.test(model)) {
    body.instructions = instructions;
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    const lower = detail.toLowerCase();
    if (
      response.status === 401 ||
      response.status === 402 ||
      response.status === 403 ||
      response.status === 429 ||
      lower.includes("quota") ||
      lower.includes("insufficient") ||
      lower.includes("rate limit") ||
      lower.includes("billing")
    ) {
      throw markQuotaError(
        "OpenAI TTS unavailable (quota or auth). Using free device voice."
      );
    }
    throw new Error(
      `OpenAI TTS failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audio: Buffer.from(arrayBuffer),
    contentType: wantWav ? "audio/wav" : "audio/mpeg",
  };
}

/**
 * Synthesize reply audio.
 * Chain: ElevenLabs → Google en-GB female → OpenAI female (non-British).
 * Throws with code FALLBACK_BROWSER only when no server audio is possible.
 */
export async function synthesizeNovaSpeech(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string; provider: NovaVoiceProvider }> {
  const errors: string[] = [];

  if (isElevenLabsConfigured()) {
    try {
      const result = await synthesizeElevenLabs(text, opts);
      console.info(
        `[nova speak] provider=elevenlabs voice=${process.env.ELEVENLABS_VOICE_ID?.trim() || cachedVoiceId || "default"} bytes=${result.audio.length}`
      );
      return { ...result, provider: "elevenlabs" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ElevenLabs failed";
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code ?? "")
          : "";
      errors.push(msg);
      if (!hasAnyLaterProvider("elevenlabs")) {
        throw err;
      }
      const next = hasBritishServerFallback()
        ? "Google TTS (British female)"
        : "OpenAI TTS (non-British last resort)";
      console.warn(
        `[nova speak] ElevenLabs failed (${code || "error"}); falling through to ${next}:`,
        msg
      );
    }
  }

  if (isGoogleTtsConfigured()) {
    try {
      const result = await synthesizeGoogle(text, opts);
      const viaFallback = isElevenLabsConfigured();
      const voice =
        process.env.GOOGLE_TTS_VOICE?.trim() || DEFAULT_GOOGLE_TTS_VOICE;
      console.info(
        `[nova speak] provider=google${viaFallback ? " (ElevenLabs fallback)" : ""} voice=${voice} bytes=${result.audio.length}`
      );
      return { ...result, provider: "google" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google TTS failed";
      errors.push(msg);
      if (!hasAnyLaterProvider("google")) {
        const out = markQuotaError(
          errors.join(" | ") || "Server TTS unavailable. Using free device voice."
        );
        (out as Error & { code?: string }).code = "FALLBACK_BROWSER";
        throw out;
      }
      console.warn(
        "[nova speak] Google TTS failed; falling through to OpenAI TTS:",
        msg
      );
    }
  }

  if (isOpenAITtsConfigured()) {
    try {
      const result = await synthesizeOpenAI(text, opts);
      const viaFallback =
        isElevenLabsConfigured() || isGoogleTtsConfigured();
      console.info(
        `[nova speak] provider=openai${viaFallback ? " (last resort)" : ""} model=${process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts"} voice=${process.env.OPENAI_TTS_VOICE?.trim() || "nova"} bytes=${result.audio.length}`
      );
      return { ...result, provider: "openai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OpenAI TTS failed";
      errors.push(msg);
      console.error("[nova speak] OpenAI TTS also failed:", msg);
      const out = markQuotaError(
        errors.join(" | ") || "Server TTS unavailable. Using free device voice."
      );
      (out as Error & { code?: string }).code = "FALLBACK_BROWSER";
      throw out;
    }
  }

  const err = new Error(
    "No server TTS configured. Set ELEVENLABS_API_KEY, GOOGLE_TTS_API_KEY, or OPENAI_API_KEY."
  );
  (err as Error & { code?: string }).code = "FALLBACK_BROWSER";
  throw err;
}
