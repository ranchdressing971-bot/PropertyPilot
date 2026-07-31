/**
 * ElevenLabs TTS for Nova voice replies.
 */

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export async function synthesizeNovaSpeech(
  text: string
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
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
        // Keep settings minimal — "style" breaks some models/voices with 400s.
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
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
