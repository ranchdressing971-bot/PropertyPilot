import { after, NextRequest, NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { runNovaChat } from "@/lib/nova/chat";
import { runTick } from "@/lib/nexus/runner";

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

    // If Nova kicked pipeline work during this turn, let a tick continue after
    // the reply is sent so the chat request itself stays short.
    const kickedAsync = result.toolCalls.some((t) => {
      try {
        const parsed = JSON.parse(t.result) as { async?: boolean; kicked?: boolean };
        return parsed.async === true || parsed.kicked === true;
      } catch {
        return false;
      }
    });
    if (kickedAsync) {
      after(async () => {
        try {
          await runTick();
        } catch (err) {
          console.error(
            "[nova chat] after-response tick failed:",
            err instanceof Error ? err.message : err
          );
        }
      });
    }

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
