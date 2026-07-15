import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import {
  AIInspectionData,
  AIPropertyResult,
  buildInspectionPrompt,
  buildViolationsFromAI,
  normalizeAIResults,
} from "@/lib/ai-analyze";
import { stripInspectionForStorage } from "@/lib/inspection-sanitize";
import { saveAIInspection } from "@/lib/inspection-store";
import { isOpenAIConfigured } from "@/lib/app-mode";
import type { Property } from "@/lib/mock-data";
import {
  getAuthenticatedUserId,
  loadPropertiesFromDb,
  logAudit,
} from "@/lib/supabase/persist";
import { persistEvidenceImages, persistPropertyThumbnails } from "@/lib/supabase/evidence-storage";
import { uploadFramesForVision } from "@/lib/supabase/vision-frames";
import { canRunLiveInspection, getUserSubscription, hasActiveSubscription } from "@/lib/subscription";
import { rulesToMap, DEFAULT_CCR_RULES } from "@/lib/ccr-rules";
import type { AddressReviewItem } from "@/lib/ai-analyze";
import { runAddressMatchPipeline } from "@/lib/address-match-run";
import { buildAddressCandidates } from "@/lib/geo/nearby-addresses";
import type { UploadGeoContext } from "@/lib/geo/types";
import { runAddressDetection, runHomeDiscovery } from "@/lib/address-detect-run";
import {
  discoverPropertiesFromVideo,
  propertiesFromAddressMatches,
  propertiesFromHomeDiscovery,
  propertiesFromFrameFallback,
  supplementPropertiesFromFrames,
  mergePropertyLists,
  dedupeProperties,
} from "@/lib/frame-property-map";
import {
  loadPriorInspectedAddresses,
  separatePriorInspected,
} from "@/lib/prior-inspections";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeImageDataUrl } from "@/lib/image-data-url";
import { createChatCompletion, isQuotaError, sleep } from "@/lib/openai-retry";

export const maxDuration = 120;

const BATCH_SIZE = 4;
const PAUSE_BETWEEN_COMPLIANCE_MS = 300;

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
    ...batch.flatMap((prop) => {
      const cleanImage = sanitizeImageDataUrl(prop.image);
      return [
        { type: "text" as const, text: `Property ${prop.address} (${prop.id}):` },
        ...(cleanImage
          ? [
              {
                type: "image_url" as const,
                image_url: {
                  url: cleanImage,
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
      ];
    }),
  ];

  const response = await createChatCompletion(
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    },
    "compliance"
  );

  const text =
    "choices" in response
      ? (response.choices[0]?.message?.content ?? "{}")
      : "{}";
  const parsed = JSON.parse(text) as { results?: unknown[] };
  const raw = (parsed.results ?? []) as {
    propertyId: string;
    violationType: string | null;
    confidence: number;
    reasoning: string;
  }[];

  return normalizeAIResults(raw, batch, ruleMap);
}

function isAddressVerified(prop: Property): boolean {
  if (/^Home at /i.test(prop.address) || /^Property at /i.test(prop.address)) {
    return false;
  }
  if (prop.needsAddressReview) return false;
  if (prop.addressConfidence != null && prop.addressConfidence < 70) {
    return false;
  }
  return true;
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
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required for live inspections.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const limit = checkRateLimit(`analyze-inspection:${userId}`, 8, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many inspections. Wait a minute and try again.",
          code: "RATE_LIMIT",
          retryAfter: limit.retryAfterSec,
        },
        { status: 429 }
      );
    }

    const access = await canRunLiveInspection(userId);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason ?? "Subscription required for live inspections.",
          code: access.code ?? "SUBSCRIPTION_REQUIRED",
        },
        { status: 402 }
      );
    }

    // Supabase roster is source of truth; client body is backup only
    const dbRoster = await loadPropertiesFromDb(userId);
    let roster: Property[] =
      dbRoster.length > 0 ? dbRoster : clientRoster?.length ? clientRoster : [];

    const id = `ai-${Date.now()}`;
    const date = new Date().toISOString().split("T")[0];

    let scanProperties: Property[] = [];
    let addressMatches = 0;
    let frameCount = 0;
    let usedGpsPipeline = false;
    let addressReviews: AddressReviewItem[] = [];

    if (frames?.length) {
      const cleanedFrames = frames
        .map((f) => {
          const dataUrl = sanitizeImageDataUrl(f.dataUrl);
          if (!dataUrl) return null;
          return {
            index: f.index,
            timestamp: f.timestamp,
            dataUrl,
          };
        })
        .filter((f): f is NonNullable<typeof f> => Boolean(f));

      if (cleanedFrames.length === 0) {
        return NextResponse.json(
          {
            error:
              "Could not read video frames. Try a shorter MP4 (under 2 minutes) from your phone camera.",
            code: "INVALID_FRAMES",
          },
          { status: 400 }
        );
      }

      // Upload frames to storage and use HTTPS URLs for OpenAI.
      // Huge base64 data URLs often fail with "string did not follow the pattern".
      let extractedFrames = cleanedFrames;
      try {
        const hosted = await uploadFramesForVision(userId, id, cleanedFrames);
        if (hosted.length > 0) extractedFrames = hosted;
      } catch (err) {
        console.error("vision frame hosting failed, using data URLs:", err);
      }

      frameCount = extractedFrames.length;
      const imageUrls = extractedFrames.map((f) => f.dataUrl);

      const geo = body.geo as UploadGeoContext | undefined;
      const hasGps = Boolean(geo?.lat && geo?.lng);
      const candidateCtx = await buildAddressCandidates({ roster, geo, neighborhood });
      const addressMatchResults = await runAddressMatchPipeline(
        extractedFrames,
        candidateCtx,
        roster
      );
      const fromGps = propertiesFromAddressMatches(
        addressMatchResults,
        extractedFrames,
        neighborhood
      );
      // Only claim GPS pipeline when geo actually contributed candidates
      usedGpsPipeline = hasGps && fromGps.length > 0;

      const namedHomes = fromGps.filter(
        (p) => !/^Home at /i.test(p.address) && !/^Property at /i.test(p.address)
      );
      // Enough named hits → skip extra OCR/discovery (big speed win)
      const expectedHomes = Math.max(
        3,
        Math.min(8, Math.ceil(extractedFrames.length * 0.5))
      );

      if (namedHomes.length >= expectedHomes) {
        scanProperties = fromGps;
      } else {
        // Run OCR + home discovery together to cut wall-clock time
        const [detections, homes] = await Promise.all([
          runAddressDetection(imageUrls, roster),
          runHomeDiscovery(imageUrls),
        ]);
        const fromOcr = discoverPropertiesFromVideo(
          extractedFrames,
          detections,
          neighborhood,
          roster.length > 0 ? roster : undefined
        );
        const fromHomes = propertiesFromHomeDiscovery(
          extractedFrames,
          homes,
          neighborhood
        );
        scanProperties = mergePropertyLists(
          neighborhood,
          extractedFrames,
          fromGps,
          fromOcr,
          fromHomes
        );
      }

      addressMatches = scanProperties.filter(
        (p) => !/^Home at /i.test(p.address)
      ).length;

      // Fill gaps so a 6-house drive isn't stuck at 3 cards
      if (scanProperties.length < expectedHomes) {
        scanProperties = supplementPropertiesFromFrames(
          scanProperties,
          extractedFrames,
          neighborhood,
          expectedHomes
        );
      }

      scanProperties = dedupeProperties(scanProperties, extractedFrames, neighborhood);

      if (scanProperties.length === 0) {
        scanProperties = propertiesFromFrameFallback(extractedFrames, neighborhood);
        addressMatches = 0;
      }

      addressReviews = scanProperties
        .filter((p) => p.addressConfidence != null)
        .map((p) => ({
          propertyId: p.id,
          address: p.address,
          confidence: p.addressConfidence!,
          needsReview: p.needsAddressReview ?? false,
          reasoning: p.addressMatchReason,
        }));
    } else if (roster.length > 0) {
      scanProperties = roster;
    }

    if (scanProperties.length === 0 && roster.length === 0) {
      // Last resort only when no roster and no detections — avoid inventing demo homes for live users
      scanProperties = propertiesFromFrameFallback(
        frames?.map((f) => ({
          index: f.index,
          timestamp: f.timestamp,
          dataUrl: f.dataUrl,
        })) ?? [],
        neighborhood
      );
    } else if (scanProperties.length === 0 && roster.length > 0) {
      scanProperties = roster.slice(0, 20);
    }

    const priorMap = userId
      ? await loadPriorInspectedAddresses(userId, id)
      : new Map();
    const { newProperties, skipped: priorSkipped } = separatePriorInspected(
      scanProperties,
      priorMap
    );

    const subscription = userId ? await getUserSubscription(userId) : null;
    const isPaid = hasActiveSubscription(subscription?.status ?? "none");
    // Paid seats get a high home cap; free/trial stays at 50
    const homeLimit = isPaid
      ? Math.min(500, Math.max(100, (subscription?.communityCount ?? 1) * 100))
      : 50;
    const capped = newProperties.slice(0, homeLimit);

    // Only run compliance AI on verified addresses — placeholders / low-confidence
    // homes stay in results as needs-review without enforceable violations.
    const verifiedForCompliance = capped.filter(isAddressVerified);
    const unverifiedHomes = capped.filter((p) => !isAddressVerified(p));

    const batches: Property[][] = [];
    for (let i = 0; i < verifiedForCompliance.length; i += BATCH_SIZE) {
      batches.push(verifiedForCompliance.slice(i, i + BATCH_SIZE));
    }

    // Sequential batches with a short pause — keeps TPM calmer without dragging demos
    const batchResults: AIPropertyResult[][] = [];
    for (let i = 0; i < batches.length; i++) {
      if (i > 0) await sleep(PAUSE_BETWEEN_COMPLIANCE_MS);
      batchResults.push(await analyzeBatch(batches[i], ruleMap));
    }

    const unverifiedResults: AIPropertyResult[] = unverifiedHomes.map((prop) => ({
      propertyId: prop.id,
      address: prop.address,
      violationType: null,
      confidence: 0,
      recommendation: "",
      reasoning:
        "Address needs human confirmation before compliance analysis. No violation created.",
      rule: "",
    }));

    const skippedResults: AIPropertyResult[] = priorSkipped.map((prop) => ({
      propertyId: prop.id,
      address: prop.address,
      violationType: null,
      confidence: 0,
      recommendation: "",
      reasoning: `Previously inspected on ${prop.priorInspectionDate ?? "a prior drive-through"}. Skipped re-analysis.`,
      rule: "",
      previouslyInspected: true,
      priorInspectionDate: prop.priorInspectionDate,
    }));

    const propertiesToAnalyze = capped;
    const results = [
      ...batchResults.flat(),
      ...unverifiedResults,
      ...skippedResults,
    ];
    const allProperties = [...propertiesToAnalyze, ...priorSkipped];

    // Enforceable violations only from verified homes with real findings
    const violations = buildViolationsFromAI(
      id,
      batchResults.flat().filter((r) => (r.confidence ?? 0) >= 70),
      ruleMap
    );

    // Mark unverified homes in addressReviews
    for (const prop of unverifiedHomes) {
      if (!addressReviews.some((r) => r.propertyId === prop.id)) {
        addressReviews.push({
          propertyId: prop.id,
          address: prop.address,
          confidence: prop.addressConfidence ?? 0,
          needsReview: true,
          reasoning: prop.addressMatchReason ?? "Unverified address",
        });
      }
    }

    violations.forEach((v) => {
      const prop = allProperties.find((p) => p.id === v.propertyId);
      if (prop?.image) {
        v.evidenceImages = [prop.image];
      }
    });

    let propertyImages: Record<string, string> = {};
    let storedViolations = violations;

    if (userId) {
      try {
        propertyImages = await persistPropertyThumbnails(userId, id, allProperties);
      } catch (err) {
        console.error("thumbnail persist skipped:", err);
      }
      try {
        storedViolations = await persistEvidenceImages(userId, id, violations);
      } catch (err) {
        console.error("evidence persist skipped:", err);
        storedViolations = violations.map((v) => ({ ...v, evidenceImages: [] }));
      }
    }

    const inspection: AIInspectionData = {
      id,
      name: `AI Inspection — ${date}`,
      date,
      videoName,
      neighborhood,
      aiPowered: true,
      results,
      violations: storedViolations,
      frameCount,
      addressMatches,
      usedVideoFrames: Boolean(frames?.length),
      usedGpsPipeline,
      addressReviews: addressReviews.length > 0 ? addressReviews : undefined,
      propertyImages,
      previouslyInspectedCount: priorSkipped.length,
    };

    const lean = stripInspectionForStorage(inspection);
    const saveResult = await saveAIInspection(lean);

    if (userId) {
      await logAudit(userId, "inspection_complete", "inspection", id, {
        violationsFound: violations.length,
        propertiesScanned: propertiesToAnalyze.length,
        previouslyInspected: priorSkipped.length,
        frameCount,
        addressMatches,
        usedVideoFrames: Boolean(frames?.length),
        usedGpsPipeline,
        addressReviewCount: addressReviews.filter((r) => r.needsReview).length,
        persisted: saveResult.ok,
        persistError: saveResult.error,
      });
    }

    return NextResponse.json({
      id,
      mode: "live",
      violationsFound: violations.length,
      propertiesScanned: propertiesToAnalyze.length,
      previouslyInspected: priorSkipped.length,
      frameCount,
      addressMatches,
      usedVideoFrames: Boolean(frames?.length),
      usedGpsPipeline,
      addressReviewCount: addressReviews.filter((r) => r.needsReview).length,
      saved: saveResult.ok,
      saveError: saveResult.error,
      inspection: lean,
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
    } else if (
      msg.toLowerCase().includes("did not match") ||
      msg.toLowerCase().includes("did not follow") ||
      msg.toLowerCase().includes("pattern") ||
      msg.toLowerCase().includes("invalid_image")
    ) {
      userMessage =
        "Video frames were rejected. Use a short MP4 (under 2 min) from your phone camera, not a screen recording or weird format.";
      code = "INVALID_FRAMES";
    } else if (isQuotaError(error) || msg.includes("insufficient_quota")) {
      userMessage =
        "OpenAI credits ran out. Add $5–10 at platform.openai.com/settings/organization/billing — then wait ~2 min and try again.";
      code = "NO_CREDITS";
    } else if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      userMessage =
        "OpenAI hit its per-minute speed limit (not your dollar balance — $0.04 spend is normal). Wait 60 seconds and upload again. Scans now go slower on purpose so this happens less.";
      code = "RATE_LIMIT";
    }

    return NextResponse.json({ error: userMessage, code, detail: msg }, { status: 500 });
  }
}
