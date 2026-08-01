/**
 * Server TTS for Nova voice replies.
 *
 * Primary: ElevenLabs (when ELEVENLABS_API_KEY is set).
 * Fallback: OpenAI TTS (when OPENAI_API_KEY is set) — required for iPhone
 * autoplay, since WebKit speechSynthesis cannot start after await fetch.
 *
 * Free ElevenLabs accounts cannot use Voice Library IDs via the API. Set
 * ELEVENLABS_VOICE_ID to the id from My Voices, OR ELEVENLABS_VOICE_NAME
 * (e.g. a British voice name) and we resolve it. If unset, we prefer a voice
 * named Nova, then the first account voice.
 *
 * OpenAI fallback defaults: `gpt-4o-mini-tts` + feminine voice `coral`
 * with light British-woman instructions, speed ~1.2.
 * ElevenLabs speaking rate defaults to ~1.15 (env: ELEVENLABS_SPEED).
 */

import { getOpenAIApiKey } from "@/lib/openai-env";

let cachedVoiceId: string | null = null;

export type NovaVoiceProvider = "elevenlabs" | "openai";
export type NovaSpeechFormat = "mpeg" | "wav";

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function isOpenAITtsConfigured(): boolean {
  return Boolean(getOpenAIApiKey());
}

/** True when at least one server TTS provider can return audio bytes. */
export function isServerTtsConfigured(): boolean {
  return isElevenLabsConfigured() || isOpenAITtsConfigured();
}

export function preferredNovaVoiceProvider(): NovaVoiceProvider | null {
  if (isElevenLabsConfigured()) return "elevenlabs";
  if (isOpenAITtsConfigured()) return "openai";
  return null;
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
 */
export async function resolveElevenLabsVoiceId(apiKey: string): Promise<string> {
  if (cachedVoiceId) return cachedVoiceId;

  const rawId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const rawName = process.env.ELEVENLABS_VOICE_NAME?.trim();

  // Exact voice id from env — use directly (fast path).
  if (rawId && looksLikeVoiceId(rawId)) {
    cachedVoiceId = rawId;
    return cachedVoiceId;
  }

  const voices = await listAccountVoices(apiKey);
  if (voices.length === 0) {
    throw new Error(
      "No ElevenLabs voices on this account. Create/clone one in My Voices, then set ELEVENLABS_VOICE_ID (the id, not the name)."
    );
  }

  // Env was a name like "Nova" put in VOICE_ID by mistake — resolve by name.
  const nameHint = rawName || (rawId && !looksLikeVoiceId(rawId) ? rawId : "Nova");
  const byName = findByName(voices, nameHint);
  if (byName) {
    cachedVoiceId = byName.voice_id;
    return cachedVoiceId;
  }

  if (rawId && !looksLikeVoiceId(rawId)) {
    const available = voices.map((v) => v.name).slice(0, 8).join(", ");
    throw new Error(
      `No voice named "${rawId}" on this ElevenLabs account. Available: ${available}. Set ELEVENLABS_VOICE_ID to the voice ID (⋯ → Copy voice ID), not the display name.`
    );
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

async function synthesizeElevenLabs(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = await resolveElevenLabsVoiceId(apiKey);
  const model =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const wantWav = opts?.format === "wav";
  const outputFormat = wantWav ? "pcm_44100" : "mp3_44100_128";
  const clipped = clipSpeechText(text);
  // Slightly brisker than default (1.0); ElevenLabs accepts ~0.7–1.2.
  const speed = parseSpeechSpeed(process.env.ELEVENLABS_SPEED, 1.15, 0.7, 1.2);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: wantWav ? "audio/pcm" : "audio/mpeg",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: model,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          speed,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const lower = detail.toLowerCase();
    cachedVoiceId = null;

    if (
      response.status === 401 ||
      response.status === 402 ||
      response.status === 429 ||
      lower.includes("quota") ||
      lower.includes("credit") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests") ||
      lower.includes("payment") ||
      lower.includes("insufficient")
    ) {
      throw markQuotaError(
        "ElevenLabs credits exhausted or rate-limited."
      );
    }

    if (
      lower.includes("paying") ||
      lower.includes("library") ||
      lower.includes("subscription")
    ) {
      throw new Error(
        "That ElevenLabs voice needs a paid plan. Use your custom “Nova” voice from My Voices. Copy its voice ID (not the name) into ELEVENLABS_VOICE_ID."
      );
    }
    if (response.status === 404) {
      throw new Error(
        "ElevenLabs voice not found. You probably set the name “Nova” instead of the voice ID. In Voices → Nova → ⋯ → Copy voice ID → ELEVENLABS_VOICE_ID."
      );
    }
    throw new Error(
      `ElevenLabs failed (${response.status}): ${detail.slice(0, 300)}`
    );
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
  // gpt-4o-mini-tts supports style `instructions` (British young woman).
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  // Feminine voices: coral, nova, shimmer, sage. Avoid fable/onyx/echo (male/deep).
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || "coral";
  // Brisk but natural — OpenAI TTS speed range is 0.25–4.0.
  const speed = parseSpeechSpeed(process.env.OPENAI_TTS_SPEED, 1.2, 0.25, 4.0);
  const instructions =
    process.env.OPENAI_TTS_INSTRUCTIONS?.trim() ||
    "Young British woman. Clear, warm, natural — not deep or masculine.";

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
 * Synthesize reply audio. Prefers ElevenLabs, falls back to OpenAI TTS.
 * Throws with code QUOTA / FALLBACK_BROWSER only when no server audio is possible.
 */
export async function synthesizeNovaSpeech(
  text: string,
  opts?: { format?: NovaSpeechFormat }
): Promise<{ audio: Buffer; contentType: string; provider: NovaVoiceProvider }> {
  const errors: string[] = [];

  if (isElevenLabsConfigured()) {
    try {
      const result = await synthesizeElevenLabs(text, opts);
      return { ...result, provider: "elevenlabs" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ElevenLabs failed";
      errors.push(msg);
      if (!isOpenAITtsConfigured()) {
        throw err;
      }
      console.warn("nova speak: ElevenLabs failed, trying OpenAI TTS:", msg);
    }
  }

  if (isOpenAITtsConfigured()) {
    try {
      const result = await synthesizeOpenAI(text, opts);
      return { ...result, provider: "openai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OpenAI TTS failed";
      errors.push(msg);
      const out = markQuotaError(
        errors.join(" | ") || "Server TTS unavailable. Using free device voice."
      );
      (out as Error & { code?: string }).code = "FALLBACK_BROWSER";
      throw out;
    }
  }

  const err = new Error(
    "No server TTS configured. Set ELEVENLABS_API_KEY or OPENAI_API_KEY."
  );
  (err as Error & { code?: string }).code = "FALLBACK_BROWSER";
  throw err;
}
