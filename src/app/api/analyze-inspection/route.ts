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
import { properties, inspections } from "@/lib/mock-data";
import { isOpenAIConfigured } from "@/lib/app-mode";

const BATCH_SIZE = 4;

async function analyzeBatch(
  batch: typeof properties
): Promise<AIPropertyResult[]> {
  const content: ChatCompletionContentPart[] = [
    { type: "text", text: buildInspectionPrompt(batch) },
    ...batch.flatMap((prop) => [
      { type: "text" as const, text: `Property ${prop.address} (${prop.id}):` },
      {
        type: "image_url" as const,
        image_url: { url: prop.image, detail: "low" as const },
      },
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

  return normalizeAIResults(raw, batch);
}

function demoResponse(videoName: string) {
  const demo = inspections[0];
  return NextResponse.json({
    id: demo.id,
    mode: "demo",
    violationsFound: demo.violationsFound,
    propertiesScanned: demo.propertiesScanned,
    videoName,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoName = (body.videoName as string) || "inspection.mp4";
    const mode = (body.mode as string) || "live";

    if (mode === "demo") {
      return demoResponse(videoName);
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        {
          error:
            "Live mode requires OPENAI_API_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy. Or switch to Demo mode.",
          code: "MISSING_API_KEY",
        },
        { status: 503 }
      );
    }

    const id = `ai-${Date.now()}`;
    const date = new Date().toISOString().split("T")[0];

    const batches: (typeof properties)[] = [];
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      batches.push(properties.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map(analyzeBatch));
    const results = batchResults.flat();

    const violations = buildViolationsFromAI(id, results);

    violations.forEach((v) => {
      const prop = properties.find((p) => p.id === v.propertyId);
      if (prop) {
        v.evidenceImages = [prop.image];
      }
    });

    const inspection: AIInspectionData = {
      id,
      name: `AI Inspection — ${date}`,
      date,
      videoName,
      neighborhood: "Willow Creek Estates",
      aiPowered: true,
      results,
      violations,
    };

    saveAIInspection(inspection);

    return NextResponse.json({
      id,
      mode: "live",
      violationsFound: violations.length,
      propertiesScanned: properties.length,
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
      userMessage = "OpenAI rate limit or no billing credits. Check platform.openai.com/account/billing";
      code = "RATE_LIMIT";
    } else if (msg.includes("insufficient_quota")) {
      userMessage = "OpenAI account has no credits. Add billing at platform.openai.com";
      code = "NO_CREDITS";
    }

    return NextResponse.json({ error: userMessage, code, detail: msg }, { status: 500 });
  }
}
