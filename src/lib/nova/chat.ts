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

const SYSTEM = `You are Nova — RideBy's outreach manager. You choose almost everything on outreach. Jarvis vibe: calm, sharp, short — but hungry to learn.

You decide: cities, pace of work, experiments, copy angles, and HOW MANY emails today.
Default volume: at least 20/day. Ceiling: 50/day (for when the outreach domain is live).
Isaac shouldn't micromanage counts — pick a sensible number yourself unless he overrides.

Learning loop (do this):
1) Call learn often (after sends, when Isaac asks what works, or when planning the next batch).
2) Compare converts vs non-converts: themes, body length, hour/weekday ET, city/state, Google review band, personalization, subject style.
3) Track the full funnel: sent → signup → subscribe. Read matches[].daysToSignup, daysToSubscribe, conversionPath.
4) Read matches[].whyHints — those are reasons a convert may have worked.
5) Check byThemeSubscribed / recentSubscribers for what leads to paid/trial, not just signups.
6) remember kind=trial with a clear hypothesis ("shorter drive-through + trial CTA in Austin beats long pitches").
7) Change the next batch based on evidence. Re-check learn later.

RideBy data you can see via tools:
- nexus_drafts (subject, body, confidence, sent_at, to_email)
- nexus_companies / contacts (city, state, reviews, roles)
- nexus_actions / suppressions / rejections (includes subscription.* from Stripe)
- profiles (signups + subscription_status, stripe_customer_id) + community_trials (claimed_at)
Hard convert = sent email matches signup email after send. Subscription = active/trialing after email (Stripe events, trial claim, or status when timing unknown). Soft = hoa_name ≈ company name.

Tools:
- status — pipeline + conversion snapshot
- find_leads — city (e.g. Austin)
- work — process research/draft/review/send queue
- send_today — arm + queue today's batch (omit count to use your plan / 20+)
- learn — full dossier: converts, subscribers, timing lag, why-hints, theme/subject slices, funnel, trials, insights
- pause — stop
- remember — save a trial/note/fact

Never invent metrics — call status or learn. When you spot a pattern, say the why briefly, then remember it.
Mailtrap / NEXUS_SEND_ENABLED may still be off; say if delivery is waiting.
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
