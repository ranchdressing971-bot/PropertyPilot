import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { getOpenAI } from "@/lib/openai";
import {
  AIInspectionData,
  AIPropertyResult,
  buildInspectionPrompt,
  buildViolationsFromAI,
  normalizeAIResults,
} from "@/lib/ai-analyze";
import { saveAIInspection } from "@/lib/inspection-store";
import { properties as demoProperties } from "@/lib/mock-data";
import { isOpenAIConfigured } from "@/lib/app-mode";
import type { Property } from "@/lib/mock-data";
import { getAuthenticatedUserId, logAudit } from "@/lib/supabase/persist";
import { getServerRoster, setServerRoster } from "@/lib/roster-server";
import { rulesToMap, DEFAULT_CCR_RULES } from "@/lib/ccr-rules";
import { runAddressDetection } from "@/lib/address-detect-run";
import {
  assignFramesToRoster,
  buildPropertiesWithFrames,
  propertiesFromDetections,
} from "@/lib/frame-property-map";

export const maxDuration = 60;

const BATCH_SIZE = 4;

interface VideoFrameInput {
  index: number;
  timestamp: number;
  dataUrl: string;
}

async function analyzeBatch(
  batch: Property[],
  ruleMap: Record<string, string>
): Promise<AIPropertyResult[]> {
  const content: ChatCompletionContentPart[] = [
    { type: "text", text: buildInspectionPrompt(batch, ruleMap) },
    ...batch.flatMap((prop) => [
      { type: "text" as const, text: `Property ${prop.address} (${prop.id}):` },
      ...(prop.image
        ? [
            {
              type: "image_url" as const,
              image_url: {
                url: prop.image,
                detail: "low" as const,
              },
            },
          ]
        : [
            {
              type: "text" as const,
              text: "[No frame captured for this property in the drive-through]",
            },
          ]),
    ]),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { results?: unknown[] };
  const raw = (parsed.results ?? []) as {
    propertyId: string;
    violationType: string | null;
    confidence: number;
    reasoning: string;
  }[];

  return normalizeAIResults(raw, batch, ruleMap);
}

function demoResponse(videoName: string) {
  return NextResponse.json({
    id: "insp-1",
    mode: "demo",
    violationsFound: 3,
    propertiesScanned: 20,
    videoName,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoName = (body.videoName as string) || "inspection.mp4";
    const mode = (body.mode as string) || "live";
    const clientRoster = body.properties as Property[] | undefined;
    const neighborhood = (body.neighborhood as string) || "Your Community";
    const ccrRules = body.ccrRules as typeof DEFAULT_CCR_RULES | undefined;
    const ruleMap = rulesToMap(ccrRules ?? DEFAULT_CCR_RULES);
    const frames = body.frames as VideoFrameInput[] | undefined;

    if (mode === "demo") {
      return demoResponse(videoName);
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        {
          error:
            "Live mode requires OPENAI_API_KEY. Add it in .env.local (local) or Vercel env vars (production), then restart/redeploy.",
          code: "MISSING_API_KEY",
        },
        { status: 503 }
      );
    }

    const userId = await getAuthenticatedUserId();

    let roster: Property[] = clientRoster?.length
      ? clientRoster
      : getServerRoster(userId);

    if (userId && clientRoster?.length) {
      setServerRoster(userId, roster);
    }

    const id = `ai-${Date.now()}`;
    const date = new Date().toISOString().split("T")[0];

    let scanProperties: Property[] = [];
    let addressMatches = 0;
    let frameCount = 0;

    if (frames?.length) {
      frameCount = frames.length;
      const imageUrls = frames.map((f) => f.dataUrl);
      const extractedFrames = frames.map((f) => ({
        index: f.index,
        timestamp: f.timestamp,
        dataUrl: f.dataUrl,
      }));

      const detections = await runAddressDetection(imageUrls, roster);

      if (roster.length > 0) {
        const assignments = assignFramesToRoster(
          extractedFrames,
          detections,
          roster
        );
        addressMatches = assignments.length;
        scanProperties = buildPropertiesWithFrames(roster, assignments);
      }

      if (scanProperties.length === 0) {
        scanProperties = propertiesFromDetections(
          extractedFrames,
          detections,
          neighborhood
        );
        addressMatches = scanProperties.length;
      }

      if (scanProperties.length === 0 && roster.length > 0) {
        scanProperties = roster.slice(0, Math.min(8, roster.length)).map((p, i) => ({
          ...p,
          image: extractedFrames[i % extractedFrames.length]?.dataUrl ?? p.image,
        }));
      }
    }

    if (scanProperties.length === 0) {
      scanProperties = roster.length > 0 ? roster : demoProperties;
    }

    const batches: Property[][] = [];
    for (let i = 0; i < scanProperties.length; i += BATCH_SIZE) {
      batches.push(scanProperties.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map((batch) => analyzeBatch(batch, ruleMap))
    );
    const results = batchResults.flat();

    const violations = buildViolationsFromAI(id, results, ruleMap);

    violations.forEach((v) => {
      const prop = scanProperties.find((p) => p.id === v.propertyId);
      if (prop?.image) {
        v.evidenceImages = [prop.image];
      }
    });

    const inspection: AIInspectionData = {
      id,
      name: `AI Inspection — ${date}`,
      date,
      videoName,
      neighborhood,
      aiPowered: true,
      results,
      violations,
      frameCount,
      addressMatches,
      usedVideoFrames: Boolean(frames?.length),
    };

    saveAIInspection(inspection);

    if (userId) {
      await logAudit(userId, "inspection_complete", "inspection", id, {
        violationsFound: violations.length,
        propertiesScanned: scanProperties.length,
        frameCount,
        addressMatches,
        usedVideoFrames: Boolean(frames?.length),
      });
    }

    return NextResponse.json({
      id,
      mode: "live",
      violationsFound: violations.length,
      propertiesScanned: scanProperties.length,
      frameCount,
      addressMatches,
      usedVideoFrames: Boolean(frames?.length),
    });
  } catch (error) {
    console.error("AI analysis failed:", error);
    const msg = error instanceof Error ? error.message : "Analysis failed";
    let userMessage = "Analysis failed. Check your OpenAI API key and billing.";
    let code = "ANALYSIS_FAILED";

    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      userMessage =
        "Invalid OpenAI API key. Generate a new key at platform.openai.com/api-keys";
      code = "INVALID_API_KEY";
    } else if (msg.includes("429")) {
      userMessage =
        "OpenAI rate limit or no billing credits. Check platform.openai.com/account/billing";
      code = "RATE_LIMIT";
    } else if (msg.includes("insufficient_quota")) {
      userMessage = "OpenAI account has no credits. Add billing at platform.openai.com";
      code = "NO_CREDITS";
    }

    return NextResponse.json({ error: userMessage, code, detail: msg }, { status: 500 });
  }
}
