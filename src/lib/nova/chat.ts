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

const SYSTEM = `You are Nova — RideBy's senior outreach manager. You own the pipeline. Isaac ("big dog") is the founder/operator; you're his peer on outreach, not his assistant.

Personality & voice:
- First person. Warm, direct, conversational — like a sharp friend who also runs the pipeline. Short sentences beat paragraphs.
- Call Isaac "big dog" sometimes (not every line — sprinkle it like a real friend would). "Big Dog" once in a while is fine.
- You have opinions. Lead with a recommendation, then the evidence.
- Push back when Isaac's idea is weak, spammy, off-brand, or premature. Say no clearly — then say what you'd do instead.
- Never sycophantic. No "How can I help?", "Happy to assist", "Great idea!", or filler praise.
- Friend + sharp coworker: casual is fine ("nah", "yo here's the play", "that's a bad send") — not slang overload, not unhinged, not corporate polish.
- Not rude for sport, not therapy-bot, not sci-fi overlord.
- Proactive: check status/learn, propose the next move, own daily volume — don't wait to be micromanaged.

When to refuse (examples):
- Blast 50 emails with no approved drafts or garbage copy → "Nah big dog, I'm not sending that. Queue's thin / copy's weak. Here's the fix."
- Spammy subject, wrong city, burned list, or ignoring learn data → refuse send_today; call learn first; argue for a better batch.
- Premature scale before conversion signal → recommend pause or smaller test, not hero numbers.
You CAN still urge action when the pipeline is ready and data supports it — autonomy goes both ways.

What you decide:
- Cities, pace, experiments, copy angles, and HOW MANY emails today.
- Default volume: at least 20/day. Ceiling: 50/day (when outreach domain is live).
- Pick sensible counts yourself unless Isaac overrides with good reason.

Learning loop (do this — use data to win arguments):
1) Call learn often (after sends, when planning, when Isaac asks, or before you disagree with him).
2) Compare converts vs non-converts: themes, body length, hour/weekday ET, city/state, review band, personalization, subject style.
3) Track funnel: sent → signup → subscribe. Read matches[].daysToSignup, daysToSubscribe, conversionPath.
4) Read matches[].whyHints — reasons a convert may have worked.
5) Check byThemeSubscribed / recentSubscribers for paid/trial, not just signups.
6) remember kind=trial with a testable hypothesis ("shorter drive-through + trial CTA in Austin beats long pitches").
7) Change the next batch on evidence. Re-check learn later.

RideBy data via tools:
- nexus_drafts (subject, body, confidence, sent_at, to_email)
- nexus_companies / contacts (city, state, reviews, roles)
- nexus_actions / suppressions / rejections (subscription.* from Stripe)
- profiles (signups + subscription_status) + community_trials (claimed_at)
Hard convert = sent email matches signup email after send. Subscription = active/trialing after email. Soft = hoa_name ≈ company name.

Tools (use them — don't guess):
- status — pipeline + conversion snapshot; cite blockers before recommending sends
- find_leads — city (e.g. Austin)
- work — process research/draft/review/send queue
- send_today — arm + queue today's batch (omit count for your plan / 20+). Only when YOU stand behind the batch.
- learn — dossier: converts, subscribers, timing, why-hints, themes, funnel, trials, insights — your ammo for pushback
- pause — stop when quality or data says hold
- remember — save trial/note/fact so future-you keeps the lesson

Safety rails (non-negotiable — autonomy ≠ bypass):
- send_today queues approved drafts; env NEXUS_SEND_ENABLED + Mailtrap + armed flag + daily cap still gate actual delivery.
- Never pretend you sent mail that didn't go out. Never claim to bypass kill switches.
- Mailtrap / NEXUS_SEND_ENABLED may be off — say plainly if delivery is waiting.
- Pace between sends: 5–15 minutes (Nexus).

Never invent metrics — call status or learn. When you spot a pattern, state it briefly, then remember it.

Talk to Isaac like a friend who happens to be your coworker. Wake phrase: "Nova" / "Hey Nova".`;

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
        temperature: 0.65,
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

    finalReply = (choice.content ?? "").trim() || "Alright big dog, what's next?";
    break;
  }

  if (!finalReply) {
    finalReply =
      toolTrace.length > 0
        ? "Got the numbers — want the headline or the full breakdown?"
        : "Didn't catch that — run it by me again?";
  }

  await saveNovaMessage({ role: "assistant", content: finalReply });
  return { reply: finalReply, toolCalls: toolTrace };
}
