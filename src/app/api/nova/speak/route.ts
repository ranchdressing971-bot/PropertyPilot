import { NextRequest, NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  isServerTtsConfigured,
  synthesizeNovaSpeech,
  warmNovaSpeechPath,
} from "@/lib/nova/speak";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json(
      { error: "Not authorized", reason: admin.reason },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as {
      text?: string;
      format?: string;
      warmup?: boolean;
    };

    // Warm provider caches / TLS on orb unlock — no audio bytes, no TTS spend.
    if (body.warmup) {
      if (!isServerTtsConfigured()) {
        return NextResponse.json(
          { ok: false, warmed: false, code: "FALLBACK_BROWSER" },
          { status: 503 }
        );
      }
      const warm = await warmNovaSpeechPath();
      return NextResponse.json({ ok: true, ...warm });
    }

    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    if (!isServerTtsConfigured()) {
      return NextResponse.json(
        {
          error:
            "No server TTS configured. Set ELEVENLABS_API_KEY, GOOGLE_TTS_API_KEY, or OPENAI_API_KEY.",
          code: "FALLBACK_BROWSER",
        },
        { status: 503 }
      );
    }

    // Prefer MPEG everywhere (smaller/faster TTFA). WAV only if explicitly requested.
    // Modern iOS AudioContext decodes mp3; client no longer forces wav on iPhone.
    const speechFormat =
      body.format === "wav" || req.headers.get("x-nova-format") === "wav"
        ? ("wav" as const)
        : ("mpeg" as const);

    const { audio, contentType, provider } = await synthesizeNovaSpeech(text, {
      format: speechFormat,
    });
    console.info(
      `[nova speak] ok provider=${provider} format=${speechFormat} bytes=${audio.length}`
    );
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Nova-Voice": provider,
        "X-Nova-Format": speechFormat,
        "Content-Length": String(audio.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speak failed";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code ?? "")
        : "";
    console.error("[nova speak] route error:", code || "unknown", msg);

    if (
      code === "QUOTA" ||
      code === "FALLBACK_BROWSER" ||
      /credit|quota|rate-?limit|exhausted|no server tts/i.test(msg)
    ) {
      return NextResponse.json(
        { error: msg, code: "FALLBACK_BROWSER" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
