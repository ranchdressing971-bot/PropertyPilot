import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoReel } from "@/components/demo/DemoReel";

export const metadata: Metadata = {
  title: "RideBy — Demo reel",
  description: "Auto-playing inspection results demo for screen recordings.",
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
