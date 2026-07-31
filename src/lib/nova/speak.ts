/**
 * ElevenLabs TTS for Nova voice replies.
 *
 * Free accounts cannot use Voice Library IDs via the API (that includes the
 * old "Rachel" default). Prefer ELEVENLABS_VOICE_ID from My Voices, otherwise
 * we pick the first voice ElevenLabs returns for this API key.
 */

let cachedVoiceId: string | null = null;

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

async function listAccountVoices(apiKey: string): Promise<
  Array<{ voice_id: string; name: string; category?: string }>
> {
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
  const data = (await response.json()) as {
    voices?: Array<{ voice_id: string; name: string; category?: string }>;
  };
  return data.voices ?? [];
}

/**
 * Resolve a voice the API key is allowed to use.
 * Env wins; else first premade/default/cloned voice on the account.
 */
export async function resolveElevenLabsVoiceId(apiKey: string): Promise<string> {
  const fromEnv = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedVoiceId) return cachedVoiceId;

  const voices = await listAccountVoices(apiKey);
  if (voices.length === 0) {
    throw new Error(
      "No ElevenLabs voices on this account. Open elevenlabs.io → Voices → pick one → Copy voice ID → set ELEVENLABS_VOICE_ID on Vercel."
    );
  }

  // Prefer non-library categories when present (premade / cloned / generated).
  const preferred =
    voices.find((v) =>
      /^(premade|cloned|generated|professional)$/i.test(v.category ?? "")
    ) ?? voices[0];

  cachedVoiceId = preferred.voice_id;
  return cachedVoiceId;
}

export async function synthesizeNovaSpeech(
  text: string
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = await resolveElevenLabsVoiceId(apiKey);
  const model =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  const clipped = text.trim().slice(0, 2500);
  if (!clipped) throw new Error("Nothing to speak");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: model,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const lower = detail.toLowerCase();
    if (
      lower.includes("paying") ||
      lower.includes("library") ||
      lower.includes("subscription") ||
      response.status === 402
    ) {
      // Stale/cached library id — clear cache so next attempt re-lists
      cachedVoiceId = null;
      throw new Error(
        "That ElevenLabs voice needs a paid plan (Voice Library). In elevenlabs.io → Voices → My Voices, copy a free/default voice ID and set ELEVENLABS_VOICE_ID on Vercel, then redeploy."
      );
    }
    throw new Error(
      `ElevenLabs failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audio: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}
