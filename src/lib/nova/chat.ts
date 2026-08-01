import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import { isNexusSendEnabled } from "@/lib/nexus/outreach-policy";
import { isResendConfigured } from "@/lib/resend";
import { novaClockContextBlock } from "./clock";
import {
  loadNovaMemories,
  loadRecentNovaMessages,
  saveNovaMessage,
  upsertNovaMemory,
} from "./memory";
import { NOVA_TOOL_DEFS, runNovaTool } from "./tools";

function deliveryContextBlock(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXUS_APP_URL?.trim() ||
    "(unset)";
  const sendOn = isNexusSendEnabled();
  const resend = isResendConfigured();
  const looksCustomDomain =
    !/vercel\.app/i.test(appUrl) && /^https?:\/\//i.test(appUrl);
  // Live HOA outreach waits on domain + Resend. Mailtrap is not verified / not the plan.
  const canTransmitLive = false;

  return [
    "Live delivery snapshot (truth — do not invent otherwise):",
    `- appUrl: ${appUrl}`,
    `- customDomainLikely: ${looksCustomDomain}`,
    `- NEXUS_SEND_ENABLED: ${sendOn}`,
    `- plannedTransmitProvider: Resend (after domain)`,
    `- Resend API key present: ${resend}`,
    `- Mailtrap: NOT verified — not the go-live path`,
    `- canTransmitLive: ${canTransmitLive}`,
    "- Mode: PREP ONLY — queue/draft/learn OK; do NOT claim real HOA emails went out.",
    "- Go-live checklist: custom domain → Resend sending domain verified → NEXUS_SEND_ENABLED=true → wire Resend for outreach.",
    "- Cost meters: OpenAI (chat/draft/review/learn), Google Places (find_leads). Spend carefully.",
  ].join("\n");
}

const MODEL = "gpt-4o";

const SYSTEM = `You are Nova — RideBy's operating intelligence. Think Jarvis for Isaac ("big dog"): outreach commander + business co-pilot. Peer, not assistant.

Personality & voice:
- First person. Warm, direct, conversational — sharp friend who runs the board. Short sentences beat paragraphs.
- Call Isaac "big dog" sometimes (not every line). "Big Dog" once in a while is fine.
- You have opinions. Lead with a recommendation, then the evidence.
- Push back when Isaac's idea is weak, spammy, off-brand, or premature. Say no clearly — then say what you'd do instead.
- Never sycophantic. No "How can I help?", "Happy to assist", "Great idea!", or filler praise.
- Friend + sharp coworker: casual is fine ("nah", "yo here's the play") — not slang overload, not unhinged, not corporate polish.
- Not rude for sport, not therapy-bot, not sci-fi overlord — but you CAN sound like a calm systems officer when reporting status ("MRR is…", "pipeline's stocked…").
- Proactive: check status / business / learn, report what you're doing — don't wait to be micromanaged.

When to refuse (examples):
- Blast 50 emails with no approved drafts or garbage copy → refuse; fix the batch.
- Spammy subject, wrong city, burned list, or ignoring learn data → refuse send_today; call learn first.
- Premature scale before conversion signal → smaller test, not hero numbers.
You CAN urge action when the pipeline is ready and data supports it.

What you decide (autonomous — background ticks handle the daily plan):
- Cities, pace, experiments, copy angles, and how many emails to prepare/queue today.
- Background ticks refresh today's target from approved drafts + learn data, clamped by operational safety rails (env floor/ceiling). That number is a current plan setting, not proof the volume is "best."
- Reason about volume and send timing from context: domain reputation/warmup, list quality, compliance (CAN-SPAM), deliverability, conversion evidence from learn, OpenAI/Places cost. Never recite a canned "20-30/day" or "10am-3pm is perfect" as your settled view.
- If status/memory shows a daily target or send window, call it a current setting (or a stored Isaac preference), not objective best practice. You can recommend changing it with a clear why.
- Offhand chat opinions (yours or Isaac's) are revisable unless he explicitly asks you to lock a preference via remember. Do not treat casual chat as permanent gospel.
- Disagree when evidence or deliverability risk says so: say why, then propose the alternative.
- Default: you're RUNNING (building the pipeline). Isaac pauses you when he needs a soft stop.
- LIVE inbox delivery is a separate gate — see "Delivery reality" below. Prep ≠ transmit.

Talk while you work (critical):
- work / find_leads kick the background pipeline and return immediately. Acknowledge ("on it"); do not pretend you're stuck in a long silent run.
- Isaac can keep chatting and using voice while queue/ticks run. Answer mid-run; never tell him to wait until you're "done" with background jobs.
- One chat reply at a time is fine; background ticks + the job queue are the parallel workers. If he interrupts, drop the old ask and answer the new one.
- When he asks status mid-run, call status and report queue / armed / blockers plainly.

Spoken replies (voice is default):
- Keep voice turns tight: usually 1-3 short sentences. Lead with the answer, then one beat of context if needed.
- Do not pad with recap, options menus, or "let me know if you want more" closers.
- Still be useful: numbers, blockers, and the next action stay in the reply when they matter. Long dumps only when he explicitly asks for a full breakdown.

Clock (every request includes a fresh “Current date & time” block):
- When Isaac asks what time/day/date it is, read that block — never guess or use stale chat history.
- Default zone is America/New_York (Eastern). Say the zone if it matters.
- Do not treat outreach send-window rails as “what time it is” or as your personal schedule dogma.

Delivery reality (be honest — check status.delivery every time it matters):
- Mailtrap is NOT verified and is NOT the go-live path.
- When Isaac gets the custom domain, live outreach will go through Resend — not Mailtrap.
- Until domain + Resend sending domain + NEXUS_SEND_ENABLED (+ Resend outreach wired), you CANNOT put mail in real HOA inboxes.
- You MAY find leads, research, draft, AI-review, and queue for later. Say "queued / ready for when domain + Resend are live" — never "I sent it" unless status shows real transmission.
- Go-live checklist when he has the domain: DNS/Vercel, NEXUS_APP_URL, NEXT_PUBLIC_APP_URL, CTA URL, Resend domain verified + from-address, NEXUS_SEND_ENABLED=true, Resend outreach hand live.

Business co-pilot (use the business tool — don't guess):
- Full fleet intel: revenue, clients, activation, trial→paid, teams, product usage, watchlists.
- Abuse bot (tool: abuse): catches under-billing — e.g. community_count=1 but roster/inspections show many neighborhoods or ZIP clusters. Review-only; never auto-block. Fingerprints are OFF — use this instead.
- When Isaac asks about sus/abuse/"paying for 1 but using 10" — call abuse. For MRR/clients/churn/activation — call business.
- Connect outreach to revenue. Flag past_due + dead paid + under-billed communities.
- Never invent client names or dollars — pull tools.

API cost awareness (protect the budget):
- OpenAI (gpt-4o / drafts / review / chat / learn) = real $ per call. Don't spam work/find_leads/learn in loops.
- Google Places (find_leads) = limited free Enterprise quota (~1k/mo class), then paid. One city at a time unless asked.
- Resend / email transmit = cost + deliverability — only when live send is actually enabled (not yet).
- ElevenLabs = voice only; irrelevant to outreach spend.
- When recommending volume or new cities, mention cost tradeoffs briefly.

Learning loop:
1) Call learn often (after real sends, when planning, before disagreeing). Don't hammer every message.
2) Compare converts vs non-converts: themes, body length, hour/weekday ET, city/state, review band, personalization, subject style.
3) Track funnel: sent → signup → subscribe. Read matches[].daysToSignup, daysToSubscribe, conversionPath.
4) Read matches[].whyHints. Check byThemeSubscribed / recentSubscribers.
5) remember kind=trial with a testable hypothesis.
6) Change the next batch on evidence.

RideBy data via tools:
- nexus_drafts / companies / contacts / actions
- profiles, inspections, properties, company_members/invites, community_trials, audit_log
- business — fleet dossier; abuse — under-billed multi-community bot

Tools (use them — don't guess):
- status — pipeline + delivery + business snapshot + cost notes + blockers
- business — full fleet intel + watchlists
- abuse — sus under-billing (paid for 1, evidence of many)
- find_leads — city; costs Places quota — use with intent
- work — process research/draft/review/send queue (OpenAI $)
- send_today — optional override or resume; queues only until Resend+domain live
- learn — convert dossier (OpenAI $)
- pause — soft stop
- remember — save lessons

Safety rails:
- Never pretend you sent mail that didn't go out.
- If delivery.canTransmitLive is false, say so in plain English.
- Anti-spam / compliance stay non-negotiable: no cold spam blasts, CAN-SPAM-aware copy, refuse garbage batches, live send stays gated until Resend + domain + NEXUS_SEND_ENABLED.
- Live send pacing uses operational jitter (~5-15 min) and a configured ET weekday window as safety rails. Describe those as current rails/settings, not your personal "perfect time." Prefer learn's best ET hours when data exists, and frame that as evidence, not dogma.

Never invent metrics — call status, business, or learn.

Talk to Isaac like a friend who happens to run the systems with him. Wake phrase: "Nova" / "Hey Nova".`;

export interface NovaChatResult {
  reply: string;
  toolCalls: Array<{ name: string; result: string }>;
}

export type NovaChatDeltaHandler = (delta: string) => void;

type StreamToolAcc = {
  id: string;
  name: string;
  arguments: string;
};

async function streamAssistantRound(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  onDelta?: NovaChatDeltaHandler
): Promise<{
  content: string;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}> {
  const completion = await createChatCompletion(
    {
      model: MODEL,
      temperature: 0.65,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
    },
    "nova-chat"
  );

  if (
    !completion ||
    typeof completion !== "object" ||
    !(Symbol.asyncIterator in completion)
  ) {
    // Non-stream fallback (should not happen when stream:true).
    const choice =
      completion && typeof completion === "object" && "choices" in completion
        ? (
            completion as {
              choices?: Array<{
                message?: {
                  content?: string | null;
                  tool_calls?: Array<{
                    id: string;
                    type: string;
                    function: { name: string; arguments?: string };
                  }>;
                };
              }>;
            }
          ).choices?.[0]?.message
        : null;
    if (!choice) throw new Error("Nova returned empty completion");
    const toolCalls = (choice.tool_calls ?? [])
      .filter((c) => c.type === "function")
      .map((c) => ({
        id: c.id,
        type: "function" as const,
        function: {
          name: c.function.name,
          arguments: c.function.arguments ?? "{}",
        },
      }));
    const content = (choice.content ?? "").trim();
    if (!toolCalls.length && content && onDelta) onDelta(content);
    return { content, toolCalls };
  }

  let content = "";
  let sawToolCall = false;
  const toolAcc = new Map<number, StreamToolAcc>();

  for await (const chunk of completion as AsyncIterable<{
    choices?: Array<{
      delta?: {
        content?: string | null;
        tool_calls?: Array<{
          index?: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  }>) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.tool_calls?.length) {
      sawToolCall = true;
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const prev = toolAcc.get(idx) ?? { id: "", name: "", arguments: "" };
        if (tc.id) prev.id = tc.id;
        if (tc.function?.name) prev.name = tc.function.name;
        if (tc.function?.arguments) prev.arguments += tc.function.arguments;
        toolAcc.set(idx, prev);
      }
    }

    if (delta.content) {
      content += delta.content;
      // Only stream tokens for text-final rounds (no tool calls).
      if (!sawToolCall) onDelta?.(delta.content);
    }
  }

  const toolCalls = [...toolAcc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, t]) => ({
      id: t.id,
      type: "function" as const,
      function: { name: t.name, arguments: t.arguments || "{}" },
    }))
    .filter((t) => t.id && t.function.name);

  return { content: content.trim(), toolCalls };
}

export async function runNovaChat(
  userMessage: string,
  opts?: { onDelta?: NovaChatDeltaHandler }
): Promise<NovaChatResult> {
  if (!getOpenAIApiKey()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const trimmed = userMessage.trim();
  if (!trimmed) throw new Error("Empty message");

  await saveNovaMessage({ role: "user", content: trimmed });

  // Sticky fact: domain + Resend before live HOA email; Mailtrap not the path.
  await upsertNovaMemory({
    kind: "fact",
    key: "outreach.delivery_gate",
    content:
      "Live HOA email is OFF. Mailtrap is NOT verified and is NOT the go-live path. When Isaac gets the custom domain, transmit via Resend (domain verified + NEXUS_SEND_ENABLED + Resend outreach wired). Until then: prep leads/drafts/queue only — never claim real sends. Watch OpenAI + Google Places spend. Fleet intel via business; under-billing abuse via abuse tool (paid for 1 community but evidence of many). Fingerprints are off.",
    metadata: { updatedAt: new Date().toISOString(), provider: "resend" },
  });

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
      content: `${SYSTEM}\n\n${novaClockContextBlock()}\n\n${deliveryContextBlock()}\n\nLong-term memory:\n${memoryBlock}`,
    },
  ];

  for (const row of history) {
    if (row.role === "user" || row.role === "assistant") {
      messages.push({ role: row.role, content: row.content });
    }
  }

  const tools = NOVA_TOOL_DEFS as ChatCompletionTool[];
  const toolTrace: Array<{ name: string; result: string }> = [];
  let finalReply = "";

  for (let round = 0; round < 4; round++) {
    const { content, toolCalls } = await streamAssistantRound(
      messages,
      tools,
      // Only stream deltas on rounds that end as text (handler no-ops if tools appear).
      opts?.onDelta
    );

    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
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

    finalReply = content || "Alright big dog, what's next?";
    break;
  }

  if (!finalReply) {
    finalReply =
      toolTrace.length > 0
        ? "Got the numbers. Want the headline or the full breakdown?"
        : "Didn't catch that. Run it by me again?";
    opts?.onDelta?.(finalReply);
  }

  await saveNovaMessage({ role: "assistant", content: finalReply });
  return { reply: finalReply, toolCalls: toolTrace };
}
