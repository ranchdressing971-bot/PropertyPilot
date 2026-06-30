"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { loadCcrRules } from "@/lib/ccr-rules";
import {
  extractVideoFrames,
  estimateFramesPayloadKb,
} from "@/lib/video-frames";
import { cacheInspectionClient } from "@/lib/inspection-cache";
import type { AIInspectionData } from "@/lib/ai-analyze";
import {
  Upload,
  Film,
  CheckCircle2,
  Loader2,
  Sparkles,
  FlaskConical,
} from "lucide-react";

const DEMO_STEPS = [
  "Uploading...",
  "Analyzing...",
  "Detecting Houses...",
  "Running Compliance Checks...",
  "Generating Report...",
];

const LIVE_STEPS = [
  "Reading your video...",
  "Extracting frames...",
  "Finding home addresses...",
  "Running compliance scan...",
  "Generating report...",
];

export default function UploadPage() {
  const router = useRouter();
  const { isDemo, ready } = useAppMode();
  const { profile } = useUserProfile();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = isDemo ? DEMO_STEPS : LIVE_STEPS;

  const startProcessing = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setIsProcessing(true);
      setCurrentStep(0);
      setIsComplete(false);
      setError(null);
      setStatusDetail(null);

      try {
        if (isDemo) {
          for (let i = 0; i < DEMO_STEPS.length; i++) {
            setCurrentStep(i);
            await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1200));
          }
          setIsComplete(true);
          setTimeout(() => router.push("/dashboard/inspections/insp-1"), 1000);
          return;
        }

        setCurrentStep(0);
        setStatusDetail("Preparing video...");

        const uploadForm = new FormData();
        uploadForm.append("video", file);
        const uploadPromise = fetch("/api/upload-video", {
          method: "POST",
          body: uploadForm,
        }).catch(() => null);

        setCurrentStep(1);
        setStatusDetail("Capturing frames from drive-through footage...");
        const frames = await extractVideoFrames(file, {
          intervalSec: 1.5,
          maxFrames: 20,
          maxWidth: 960,
          quality: 0.62,
        });
        setStatusDetail(
          `${frames.length} frames · ~${estimateFramesPayloadKb(frames)} KB`
        );

        setCurrentStep(2);
        const ccrRules = loadCcrRules();

        setCurrentStep(3);
        setStatusDetail("AI is reading addresses from your video...");

        const res = await fetch("/api/analyze-inspection", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoName: file.name,
            mode: "live",
            frames: frames.map((f) => ({
              index: f.index,
              timestamp: f.timestamp,
              dataUrl: f.dataUrl,
            })),
            neighborhood: profile?.hoaName || "Your Community",
            ccrRules,
          }),
        });

        await uploadPromise;

        const data = await res.json();

        if (!res.ok) {
          if (data.code === "SUBSCRIPTION_REQUIRED") {
            throw new Error(
              `${data.error} Visit Pricing to start your free trial.`
            );
          }
          throw new Error(data.error ?? "Analysis failed");
        }

        setCurrentStep(4);
        setStatusDetail(
          data.usedVideoFrames
            ? `${data.propertiesScanned ?? 0} homes found · ${data.violationsFound} flags`
            : null
        );

        if (!data.inspection) {
          throw new Error(
            "Analysis finished but results were not returned. Please try again."
          );
        }

        cacheInspectionClient(data.inspection as AIInspectionData);

        if (!data.saved) {
          setError(
            data.saveError ??
              "Scan completed but could not save to database. Open Settings → System check, or run docs/FIX_SUPABASE.sql in Supabase."
          );
          setIsProcessing(false);
          return;
        }

        setIsComplete(true);
        setTimeout(
          () => router.push(`/dashboard/inspections/${data.id}`),
          1200
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setIsProcessing(false);
      }
    },
    [router, isDemo, profile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type.includes("video") || file.name.match(/\.(mp4|mov)$/i))) {
        startProcessing(file);
      }
    },
    [startProcessing]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startProcessing(file);
  };

  if (!ready) return null;

  return (
    <DashboardLayout>
      <Header
        title="Upload Inspection"
        subtitle={
          isDemo
            ? "Demo mode — simulated analysis with sample data"
            : "Live mode — AI reads addresses from your video automatically"
        }
      />
      <PageContent className="flex min-h-[calc(100vh-12rem)] items-center">
        <div className="w-full max-w-2xl">
          {error && (
            <div className="mb-4 space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{error}</p>
              <p className="text-xs text-red-600/80">
                Tip: Use MP4 under 2 minutes, add OPENAI_API_KEY to .env.local, and
                restart the dev server.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!isProcessing ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card padding="lg">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 sm:p-16 transition-colors ${
                      isDragging
                        ? "border-copper-400 bg-copper-50/50"
                        : "border-ink-200 bg-ink-50/30 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-900">
                      <Upload className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="mt-6 text-center font-display text-lg font-semibold text-ink-900 sm:text-xl">
                      Drop your inspection video
                    </h3>
                    <p className="mt-2 text-center text-sm text-ink-500">
                      Phone drive-through · AI finds addresses · .mp4 & .mov
                    </p>
                    <div
                      className={`mt-4 flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        isDemo
                          ? "bg-copper-100 text-copper-800"
                          : "bg-ink-900 text-white"
                      }`}
                    >
                      {isDemo ? (
                        <>
                          <FlaskConical className="h-3.5 w-3.5" />
                          Demo scan
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Live video AI
                        </>
                      )}
                    </div>
                    <label className="mt-6 cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
                        <Film className="h-4 w-4" />
                        Select video
                      </span>
                      <input
                        type="file"
                        accept=".mp4,.mov,video/mp4,video/quicktime"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card padding="lg">
                  <div className="text-center">
                    {isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex flex-col items-center"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
                          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                        </div>
                        <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">
                          {isDemo ? "Demo complete" : "Analysis complete"}
                        </h3>
                        <p className="mt-2 text-sm text-ink-500">
                          Redirecting to results...
                        </p>
                      </motion.div>
                    ) : (
                      <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-ink-900">
                          <Loader2 className="h-7 w-7 animate-spin text-white" />
                        </div>
                        <h3 className="mt-6 font-display text-lg font-semibold text-ink-900">
                          Processing video
                        </h3>
                        {fileName && (
                          <p className="mt-1 truncate px-4 text-sm text-ink-500">
                            {fileName}
                          </p>
                        )}
                        {statusDetail && (
                          <p className="mt-1 text-xs text-ink-400">{statusDetail}</p>
                        )}
                      </>
                    )}
                  </div>

                  {!isComplete && (
                    <div className="mt-8 space-y-3 sm:space-y-4">
                      {steps.map((label, i) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-3"
                        >
                          {i < currentStep ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                          ) : i === currentStep ? (
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-copper-600" />
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full border-2 border-ink-200" />
                          )}
                          <span
                            className={`text-sm ${
                              i <= currentStep
                                ? "font-medium text-ink-900"
                                : "text-ink-400"
                            }`}
                          >
                            {label}
                          </span>
                        </motion.div>
                      ))}

                      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <motion.div
                          className="h-full rounded-full bg-copper-500"
                          initial={{ width: "0%" }}
                          animate={{
                            width: `${((currentStep + 1) / steps.length) * 100}%`,
                          }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
