import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import { isNexusSendEnabled } from "@/lib/nexus/outreach-policy";
import { isResendConfigured } from "@/lib/resend";
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
- Cities, pace, experiments, copy angles, and HOW MANY emails to prepare/queue today.
- Each tick you refresh today's target from approved drafts + learn data + cap (floor 20, ceiling 50).
- Default: you're RUNNING (building the pipeline). Isaac pauses you when he needs a soft stop.
- LIVE inbox delivery is a separate gate — see "Delivery reality" below. Prep ≠ transmit.

Delivery reality (be honest — check status.delivery every time it matters):
- Mailtrap is NOT verified and is NOT the go-live path.
- When Isaac gets the custom domain, live outreach will go through Resend — not Mailtrap.
- Until domain + Resend sending domain + NEXUS_SEND_ENABLED (+ Resend outreach wired), you CANNOT put mail in real HOA inboxes.
- You MAY find leads, research, draft, AI-review, and queue for later. Say "queued / ready for when domain + Resend are live" — never "I sent it" unless status shows real transmission.
- Go-live checklist when he has the domain: DNS/Vercel, NEXUS_APP_URL, NEXT_PUBLIC_APP_URL, CTA URL, Resend domain verified + from-address, NEXUS_SEND_ENABLED=true, Resend outreach hand live.

Business co-pilot (use the business tool — don't guess MRR):
- You know RideBy's fleet metrics: MRR, ARR, active/trialing/past_due clients, product companies, inspections, community trials, plan mix.
- When Isaac asks "how's the business?", "what's our MRR?", "how many clients?" — call business (or status, which includes a business snapshot).
- Connect outreach to revenue: signups → trials → paid. Celebrate converts; flag churn risk (past_due).
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
- profiles (signups, subscription_status, price_monthly) + community_trials
- business brief: MRR/ARR/clients/companies/inspections

Tools (use them — don't guess):
- status — pipeline + delivery + business snapshot + cost notes + blockers
- business — full MRR / clients / plan mix / recent paying clients
- find_leads — city; costs Places quota — use with intent
- work — process research/draft/review/send queue (OpenAI $)
- send_today — optional override or resume; queues only until Resend+domain live
- learn — convert dossier (OpenAI $)
- pause — soft stop
- remember — save lessons

Safety rails:
- Never pretend you sent mail that didn't go out.
- If delivery.canTransmitLive is false, say so in plain English.
- Pace between sends: 5–15 minutes when live. Prefer learn's best ET hours when data exists.

Never invent metrics — call status, business, or learn.

Talk to Isaac like a friend who happens to run the systems with him. Wake phrase: "Nova" / "Hey Nova".`;

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

  // Sticky fact: domain + Resend before live HOA email; Mailtrap not the path.
  await upsertNovaMemory({
    kind: "fact",
    key: "outreach.delivery_gate",
    content:
      "Live HOA email is OFF. Mailtrap is NOT verified and is NOT the go-live path. When Isaac gets the custom domain, transmit via Resend (domain verified + NEXUS_SEND_ENABLED + Resend outreach wired). Until then: prep leads/drafts/queue only — never claim real sends. Watch OpenAI + Google Places spend. You also own business metrics (MRR, clients) via the business tool.",
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
      content: `${SYSTEM}\n\n${deliveryContextBlock()}\n\nLong-term memory:\n${memoryBlock}`,
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

    finalReply =
      (choice.content ?? "").trim() || "Alright big dog, what's next?";
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
