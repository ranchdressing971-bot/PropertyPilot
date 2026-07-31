import { NextRequest, NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { isElevenLabsConfigured, synthesizeNovaSpeech } from "@/lib/nova/speak";

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
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    if (!isElevenLabsConfigured()) {
      return NextResponse.json(
        {
          error: "ElevenLabs not configured — use free device voice.",
          code: "FALLBACK_BROWSER",
        },
        { status: 503 }
      );
    }

    const { audio, contentType } = await synthesizeNovaSpeech(text);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Nova-Voice": "elevenlabs",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speak failed";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code ?? "")
        : "";
    console.error("nova speak:", err);

    if (
      code === "QUOTA" ||
      /credit|quota|rate-?limit|exhausted/i.test(msg)
    ) {
      return NextResponse.json(
        { error: msg, code: "FALLBACK_BROWSER" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
