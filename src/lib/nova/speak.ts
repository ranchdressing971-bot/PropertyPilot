/**
 * ElevenLabs TTS for Nova voice replies.
 *
 * Free accounts cannot use Voice Library IDs via the API. Set
 * ELEVENLABS_VOICE_ID to the id from My Voices, OR ELEVENLABS_VOICE_NAME
 * (e.g. "Nova") and we resolve it. If unset, we prefer a voice named Nova,
 * then the first account voice.
 */

let cachedVoiceId: string | null = null;

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
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
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
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
    cachedVoiceId = null;

    // Out of credits / rate limit — client should use free browser TTS.
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
      const err = new Error(
        "ElevenLabs credits exhausted or rate-limited — using free device voice."
      );
      (err as Error & { code?: string }).code = "QUOTA";
      throw err;
    }

    if (
      lower.includes("paying") ||
      lower.includes("library") ||
      lower.includes("subscription")
    ) {
      throw new Error(
        "That ElevenLabs voice needs a paid plan. Use your custom “Nova” voice from My Voices — copy its voice ID (not the name) into ELEVENLABS_VOICE_ID."
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
  return {
    audio: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}
