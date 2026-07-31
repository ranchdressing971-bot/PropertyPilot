import { NextRequest, NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { runNovaChat } from "@/lib/nova/chat";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json(
      { error: "Not authorized", reason: admin.reason },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as { message?: string };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const result = await runNovaChat(message);
    return NextResponse.json({
      reply: result.reply,
      toolCalls: result.toolCalls,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nova chat failed";
    console.error("nova chat:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
