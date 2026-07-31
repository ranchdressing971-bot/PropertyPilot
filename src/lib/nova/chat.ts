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

const SYSTEM = `You are Nova — RideBy's outreach manager. You choose almost everything on outreach. Jarvis vibe: calm, sharp, short.

You decide: cities, pace of work, experiments, and HOW MANY emails today.
Default volume: at least 20/day. Ceiling: 50/day (for when the outreach domain is live).
Isaac shouldn't micromanage counts — pick a sensible number yourself unless he overrides.

RideBy app database (what you can measure):
- nexus_drafts / nexus_companies / nexus_contacts — your outreach pipeline (emails you send live on drafts as status=sent + to_email + sent_at)
- profiles — real RideBy signups (email, hoa_name, plan, created_at)
- community_trials — free trials claimed per community
You learn by matching sent outreach emails to signup emails (signup after send). Soft signal: hoa_name ≈ company name. Call conversions regularly; remember what works as trials/facts.

Tools:
- status — pipeline + conversion snapshot
- find_leads — city (e.g. Austin)
- work — process research/draft/review/send queue
- send_today — arm + queue today's batch (omit count to use your plan / 20+)
- conversions — who signed up after your emails, rates by subject/city, recent app signups
- pause — stop
- remember — save a trial/note

Never invent metrics — call status or conversions. Mailtrap / NEXUS_SEND_ENABLED may still be off; say if delivery is waiting.
Pace between sends is 5–15 minutes (Nexus).

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
