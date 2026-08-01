import { after, NextRequest, NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { runNovaChat } from "@/lib/nova/chat";
import { runTick } from "@/lib/nexus/runner";

export const maxDuration = 60;

function kickAsyncTickIfNeeded(
  toolCalls: Array<{ name: string; result: string }>
) {
  const kickedAsync = toolCalls.some((t) => {
    try {
      const parsed = JSON.parse(t.result) as { async?: boolean; kicked?: boolean };
      return parsed.async === true || parsed.kicked === true;
    } catch {
      return false;
    }
  });
  if (!kickedAsync) return;
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

export async function POST(req: NextRequest) {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json(
      { error: "Not authorized", reason: admin.reason },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as { message?: string; stream?: boolean };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const wantStream = body.stream === true;

    if (!wantStream) {
      const result = await runNovaChat(message);
      kickAsyncTickIfNeeded(result.toolCalls);
      return NextResponse.json({
        reply: result.reply,
        toolCalls: result.toolCalls,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };
        try {
          const result = await runNovaChat(message, {
            onDelta: (delta) => {
              if (delta) send({ type: "delta", text: delta });
            },
          });
          kickAsyncTickIfNeeded(result.toolCalls);
          send({
            type: "done",
            reply: result.reply,
            toolCalls: result.toolCalls,
          });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Nova chat failed";
          console.error("nova chat stream:", err);
          send({ type: "error", error: msg });
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nova chat failed";
    console.error("nova chat:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
