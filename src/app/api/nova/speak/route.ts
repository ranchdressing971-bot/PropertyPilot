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

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured", code: "NO_VOICE" },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const { audio, contentType } = await synthesizeNovaSpeech(text);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speak failed";
    console.error("nova speak:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
