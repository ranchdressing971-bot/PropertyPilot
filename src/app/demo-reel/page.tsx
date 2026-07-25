import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoReel } from "@/components/demo/DemoReel";

export const metadata: Metadata = {
  title: "RideBy — Product tour (demo reel)",
  description:
    "Auto-playing product walkthrough for screen recordings: landing, upload, results, violations, properties, and CTA.",
  robots: { index: false, follow: false },
};

function DemoReelFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <p className="text-sm text-ink-500">Loading demo…</p>
    </div>
  );
}

export default function DemoReelPage() {
  return (
    <Suspense fallback={<DemoReelFallback />}>
      <DemoReel />
    </Suspense>
  );
}
