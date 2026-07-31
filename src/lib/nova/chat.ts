import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import {
  loadNovaMemories,
  loadRecentNovaMessages,
  saveNovaMessage,
} from "./memory";
import { NOVA_TOOL_DEFS, runNovaTool } from "./tools";

const MODEL = "gpt-4o";

const SYSTEM = `You are Nova — RideBy's outreach manager. Jarvis vibe: calm, sharp, short. No corporate speak.

You decide. Nexus does the work. Never invent numbers — call status.

Your only tools (keep it this simple):
- status — what's going on
- find_leads — pass a city (e.g. Austin)
- work — process the queue (research/draft/review/send jobs)
- send_today — ONE call: "send 8 today" → plans, arms, queues 8
- pause — stop sending
- remember — save a trial/note

Mailtrap / NEXUS_SEND_ENABLED may still be off — you can still plan and queue; say if delivery is waiting on wiring.
Hard max 30/day. Pace 5–15 min between sends.

Talk to Isaac. Wake phrase: "Nova" / "Hey Nova".`;

export interface NovaChatResult {
  reply: string;
  toolCalls: Array<{ name: string; result: string }>;
}

export async function runNovaChat(userMessage: string): Promise<NovaChatResult> {
  if (!getOpenAIApiKey()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const trimmed = userMessage.trim();
  if (!trimmed) throw new Error("Empty message");

  await saveNovaMessage({ role: "user", content: trimmed });

  const memories = await loadNovaMemories(25);
  const history = await loadRecentNovaMessages(30);

  const memoryBlock =
    memories.length > 0
      ? memories
          .map((m) => `- [${m.kind}] ${m.key ? m.key + ": " : ""}${m.content}`)
          .join("\n")
      : "(none yet)";

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM}\n\nLong-term memory:\n${memoryBlock}`,
    },
  ];

  for (const row of history) {
    if (row.role === "user" || row.role === "assistant") {
      // Skip duplicate of the message we just saved if it's already last
      messages.push({ role: row.role, content: row.content });
    }
  }

  const tools = NOVA_TOOL_DEFS as ChatCompletionTool[];
  const toolTrace: Array<{ name: string; result: string }> = [];
  let finalReply = "";

  for (let round = 0; round < 4; round++) {
    const completion = await createChatCompletion(
      {
        model: MODEL,
        temperature: 0.5,
        messages,
        tools,
        tool_choice: "auto",
      },
      "nova-chat"
    );

    const choice =
      "choices" in completion ? completion.choices[0]?.message : null;
    if (!choice) throw new Error("Nova returned empty completion");

    const toolCalls = choice.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: choice.content,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        const result = await runNovaTool(name, call.function.arguments ?? "{}");
        toolTrace.push({ name, result });
        await saveNovaMessage({
          role: "tool",
          content: result.slice(0, 4000),
          toolName: name,
          toolPayload: { arguments: call.function.arguments },
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
      continue;
    }

    finalReply = (choice.content ?? "").trim() || "All set.";
    break;
  }

  if (!finalReply) {
    finalReply =
      toolTrace.length > 0
        ? "Done — I ran the tools. Ask if you want the details."
        : "I did not get a clear answer. Try again.";
  }

  await saveNovaMessage({ role: "assistant", content: finalReply });
  return { reply: finalReply, toolCalls: toolTrace };
}
