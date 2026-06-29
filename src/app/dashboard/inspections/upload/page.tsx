"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Upload, Film, CheckCircle2, Loader2, Sparkles } from "lucide-react";

const UI_STEPS = [
  "Uploading...",
  "Analyzing with AI...",
  "Detecting Houses...",
  "Running Compliance Checks...",
  "Generating Report...",
];

export default function UploadPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startProcessing = useCallback(
    async (name: string) => {
      setFileName(name);
      setIsProcessing(true);
      setCurrentStep(0);
      setIsComplete(false);
      setError(null);

      const advance = (step: number, delay: number) =>
        new Promise<void>((resolve) => {
          setCurrentStep(step);
          setTimeout(resolve, delay);
        });

      try {
        await advance(0, 1200);

        setCurrentStep(1);
        const res = await fetch("/api/analyze-inspection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoName: name }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Analysis failed");
        }

        const { id } = await res.json();

        await advance(2, 800);
        await advance(3, 1000);
        await advance(4, 800);

        setIsComplete(true);
        setTimeout(() => router.push(`/dashboard/inspections/${id}`), 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setIsProcessing(false);
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type.includes("video") || file.name.match(/\.(mp4|mov)$/i))) {
        startProcessing(file.name);
      }
    },
    [startProcessing]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startProcessing(file.name);
  };

  return (
    <DashboardLayout>
      <Header title="Upload Inspection" subtitle="AI-powered drive-through analysis" />
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
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
                <Card padding="lg" glass>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 sm:p-16 transition-all duration-300 ${
                      isDragging
                        ? "border-accent-400 bg-accent-50/60 scale-[1.01]"
                        : "border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white hover:border-accent-300/60"
                    }`}
                  >
                    <div className="shine flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 shadow-xl shadow-accent-600/30">
                      <Upload className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="mt-6 text-center text-lg font-semibold text-slate-900 sm:text-xl">
                      Drop your inspection video
                    </h3>
                    <p className="mt-2 text-center text-sm text-slate-500">
                      or tap to browse · .mp4 & .mov
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      GPT-4o Vision powered
                    </div>
                    <label className="mt-6 cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-600 to-accent-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent-600/30 transition-all hover:brightness-105 active:scale-[0.98]">
                        <Film className="h-4 w-4" />
                        Select Video
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
                <Card padding="lg" glass>
                  <div className="text-center">
                    {isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex flex-col items-center"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">
                          AI Analysis Complete
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          Redirecting to results...
                        </p>
                      </motion.div>
                    ) : (
                      <>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 shadow-lg shadow-accent-600/30">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                        <h3 className="mt-6 text-lg font-semibold text-slate-900">
                          Processing Video
                        </h3>
                        {fileName && (
                          <p className="mt-1 truncate px-4 text-sm text-slate-500">
                            {fileName}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {!isComplete && (
                    <div className="mt-8 space-y-3 sm:space-y-4">
                      {UI_STEPS.map((label, i) => (
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
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-600" />
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                          )}
                          <span
                            className={`text-sm ${
                              i <= currentStep
                                ? "font-medium text-slate-900"
                                : "text-slate-400"
                            }`}
                          >
                            {label}
                          </span>
                        </motion.div>
                      ))}

                      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
                          initial={{ width: "0%" }}
                          animate={{
                            width: `${((currentStep + 1) / UI_STEPS.length) * 100}%`,
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
      </div>
    </DashboardLayout>
  );
}
