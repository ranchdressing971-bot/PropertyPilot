"use client";

import { communityDriveInstruction } from "@/lib/community-drive-copy";
import { Button } from "@/components/ui/Button";
import { MapPinned, Route } from "lucide-react";

interface CommunityDriveBriefingProps {
  /** Optional hint (e.g. from ?community=). Community assign happens on results. */
  communityName?: string;
  onContinue: () => void;
}

/**
 * Pre-upload tip: one community per video. Community pick/assign is on results.
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
      <p className="mt-4 text-xs text-ink-500">
        Tip only: your inspection always saves. We may optionally ask if new
        streets should join this community’s map.
      </p>
      <Button className="mt-6 w-full sm:w-auto" size="lg" onClick={onContinue}>
        Got it: choose video
      </Button>
    </div>
  );
}
