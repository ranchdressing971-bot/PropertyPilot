"use client";

import { communityDriveInstruction } from "@/lib/community-drive-copy";
import { Button } from "@/components/ui/Button";
import { MapPinned, Route, ShieldCheck } from "lucide-react";

interface CommunityDriveBriefingProps {
  communityName: string;
  onContinue: () => void;
}

/**
 * Pre-upload instruction: stay inside the selected community and cover main streets.
 * Shown before the drop zone accepts a video (upload stands in for “before recording”).
 */
export function CommunityDriveBriefing({
  communityName,
  onContinue,
}: CommunityDriveBriefingProps) {
  const copy = communityDriveInstruction(communityName);

  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-b from-brand-50/90 to-white px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900">
        <MapPinned className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-ink-900 sm:text-2xl">
        {copy.title}
      </h3>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-700 sm:text-base">
        {copy.body}
      </p>
      <ul className="mt-5 space-y-2.5">
        {copy.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-ink-700">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        After upload we quietly compare homes and streets to your community map —
        we’ll only ask if something looks new or unrelated.
      </p>
      <Button className="mt-6 w-full sm:w-auto" size="lg" onClick={onContinue}>
        Got it — choose video
      </Button>
    </div>
  );
}
