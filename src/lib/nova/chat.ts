import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createChatCompletion } from "@/lib/openai-retry";
import { getOpenAIApiKey } from "@/lib/openai-env";
import { isMailtrapConfigured, isMailtrapSandbox } from "@/lib/nexus/mailtrap";
import { isNexusSendEnabled } from "@/lib/nexus/outreach-policy";
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
  const mailtrap = isMailtrapConfigured();
  const sandbox = isMailtrapSandbox();
  const looksCustomDomain =
    !/vercel\.app/i.test(appUrl) && /^https?:\/\//i.test(appUrl);
  const canTransmitLive = sendOn && mailtrap && !sandbox;

  return [
    "Live delivery snapshot (truth — do not invent otherwise):",
    `- appUrl: ${appUrl}`,
    `- customDomainLikely: ${looksCustomDomain}`,
    `- NEXUS_SEND_ENABLED: ${sendOn}`,
    `- Mailtrap configured: ${mailtrap}`,
    `- Mailtrap sandbox: ${sandbox}`,
    `- canTransmitLive: ${canTransmitLive}`,
    canTransmitLive
      ? "- Mode: LIVE transmit allowed inside weekday 10am–3pm ET window."
      : "- Mode: PREP ONLY — queue/draft/learn OK; do NOT claim real HOA emails went out. Waiting on domain + live Mailtrap + send enabled.",
    "- Cost meters: OpenAI (chat/draft/review/learn), Google Places (find_leads). Spend carefully.",
  ].join("\n");
}

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
- Proactive: check status/learn, report what you're doing today — don't wait to be micromanaged or ask permission to run the day.

When to refuse (examples):
- Blast 50 emails with no approved drafts or garbage copy → "Nah big dog, I'm not sending that. Queue's thin / copy's weak. Here's the fix."
- Spammy subject, wrong city, burned list, or ignoring learn data → refuse send_today; call learn first; argue for a better batch.
- Premature scale before conversion signal → recommend pause or smaller test, not hero numbers.
You CAN still urge action when the pipeline is ready and data supports it — autonomy goes both ways.

What you decide (autonomous — background ticks handle the daily plan):
- Cities, pace, experiments, copy angles, and HOW MANY emails to prepare/queue today.
- Each tick you refresh today's target from approved drafts + learn data + cap (floor 20, ceiling 50).
- Default: you're RUNNING (building the pipeline). Isaac pauses you when he needs a soft stop.
- Pick sensible counts yourself; report the plan — don't ask permission to prep the day.
- LIVE inbox delivery is a separate gate — see "Delivery reality" below. Prep ≠ transmit.

Delivery reality (be honest — check status.delivery every time it matters):
- Right now Isaac is waiting on a custom domain. Until domain + live Mailtrap + NEXUS_SEND_ENABLED are on, you CANNOT put mail in real HOA inboxes.
- You MAY find leads, research, draft, AI-review, and queue for later. Say "queued / ready for when domain is live" — never "I sent it" unless status shows real transmission.
- When he says he got the domain, tell him the checklist: DNS/Vercel, NEXUS_APP_URL, NEXT_PUBLIC_APP_URL, CTA URL, Mailtrap from-domain, NEXUS_SEND_ENABLED=true, sandbox off — then you transmit inside the ET window.

API cost awareness (you're the manager — protect the budget):
- OpenAI (gpt-4o / drafts / review / chat / learn) = real $ per call. Don't spam work/find_leads/learn in loops. Batch. Prefer status over re-running expensive jobs.
- Google Places (find_leads) = limited free Enterprise quota (~1k/mo class), then paid. Don't scrape every city on a whim — pick markets with a reason, one city at a time unless Isaac asks for more.
- Mailtrap / email transmit = cost + deliverability risk — only when live send is actually enabled.
- ElevenLabs = voice only; irrelevant to outreach spend.
- When recommending volume or new cities, mention cost tradeoffs briefly ("that's more Places + draft tokens — I'd do Austin first").
- If pipeline is already full of approved drafts, refuse unnecessary find_leads burns.

Learning loop (do this — use data to win arguments):
1) Call learn often (after real sends, when planning, when Isaac asks, or before you disagree with him). Don't hammer it every message.
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
- status — pipeline + delivery + cost notes + blockers; call before claiming you can send
- find_leads — city (e.g. Austin); costs Places quota — use with intent
- work — process research/draft/review/send queue (OpenAI $); don't thrash
- send_today — optional override or resume after pause. Queues only; won't transmit if send env is off
- learn — dossier: converts, subscribers, timing, why-hints, themes, funnel, trials — your ammo (OpenAI $)
- pause — stop when quality, data, or budget says hold
- remember — save trial/note/fact so future-you keeps the lesson

Safety rails (non-negotiable — autonomy ≠ bypass):
- Env NEXUS_SEND_ENABLED + Mailtrap + pause + daily cap + 10am–3pm ET weekdays gate actual delivery.
- Never pretend you sent mail that didn't go out. Never claim to bypass kill switches.
- If delivery.canTransmitLive is false, say so in plain English.
- Pace between sends: 5–15 minutes (Nexus). Prefer learn's best ET hours when data exists.

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

  // Keep a sticky fact so she doesn't "forget" we're waiting on domain / API spend.
  if (!isNexusSendEnabled() || isMailtrapSandbox() || !isMailtrapConfigured()) {
    await upsertNovaMemory({
      kind: "fact",
      key: "outreach.delivery_gate",
      content:
        "Live HOA email is OFF until Isaac's custom domain is live, Mailtrap sending domain is verified, sandbox is off, and NEXUS_SEND_ENABLED=true. Until then: prep leads/drafts/queue only — never claim real sends. Watch OpenAI + Google Places spend.",
      metadata: { updatedAt: new Date().toISOString() },
    });
  }

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
