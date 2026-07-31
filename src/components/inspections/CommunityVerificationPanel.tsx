"use client";

import { useState } from "react";
import type { CommunityVerificationSummary } from "@/lib/ai-analyze";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle2,
  Loader2,
  MapPinned,
  Home,
  GitBranch,
  X,
} from "lucide-react";

interface CommunityVerificationPanelProps {
  verification: CommunityVerificationSummary;
  onResolved?: (message: string) => void;
}

export function CommunityVerificationPanel({
  verification,
  onResolved,
}: CommunityVerificationPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Quiet outcomes — optional one-line note only
  if (
    !verification.needsUserAction &&
    verification.outcome !== "bootstrap" &&
    !verification.flaggedForReview
  ) {
    return null;
  }

  if (
    !verification.needsUserAction &&
    verification.outcome === "bootstrap" &&
    !verification.helpfulMessage
  ) {
    return null;
  }

  async function resolve(resolution: string) {
    if (!verification.eventId) {
      setDismissed(true);
      return;
    }
    setLoading(resolution);
    setError(null);
    try {
      const res = await fetch("/api/community/verification/resolve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: verification.eventId,
          resolution,
          communityName: verification.communityName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      const msg = data.message ?? "Saved.";
      setDoneMessage(msg);
      onResolved?.(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(null);
    }
  }

  // Neutral / helpful tones only — never warning/alarm styling
  const toneClasses =
    verification.outcome === "bootstrap"
      ? "border-brand-200 bg-brand-50/80"
      : "border-sky-200 bg-sky-50/90";

  const title =
    verification.outcome === "bootstrap"
      ? "Community map started"
      : verification.outcome === "small_expansion"
        ? "New homes on this drive?"
        : verification.outcome === "large_difference"
          ? "Different streets on this drive?"
          : "Community map tip";

  if (doneMessage) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {doneMessage}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-600">
            <MapPinned className="h-3.5 w-3.5" />
            {title}
          </p>
          <p className="mt-1.5 text-sm text-ink-800">{verification.helpfulMessage}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (verification.needsUserAction && verification.eventId) {
              void resolve("dismiss");
            } else {
              setDismissed(true);
            }
          }}
          className="rounded-md p-1 text-ink-400 hover:bg-white/60 hover:text-ink-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {verification.outcome === "small_expansion" &&
        verification.newAddresses.length > 0 && (
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-ink-700">
            {verification.newAddresses.slice(0, 12).map((addr) => (
              <li key={addr} className="flex items-center gap-1.5">
                <Home className="h-3 w-3 shrink-0 text-ink-400" />
                {addr}
              </li>
            ))}
            {verification.newAddresses.length > 12 && (
              <li className="text-ink-500">
                +{verification.newAddresses.length - 12} more
              </li>
            )}
          </ul>
        )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {verification.needsUserAction && verification.eventId && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {verification.outcome === "small_expansion" ? (
            <>
              <Button
                size="sm"
                disabled={Boolean(loading)}
                onClick={() => resolve("confirm_new_homes")}
              >
                {loading === "confirm_new_homes" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Yes — add to this community
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={Boolean(loading)}
                onClick={() => resolve("ignore_new_homes")}
              >
                {loading === "ignore_new_homes" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Skip for now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(loading)}
                onClick={() => resolve("dismiss")}
              >
                Not now
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                disabled={Boolean(loading)}
                onClick={() => resolve("expand_fingerprint")}
              >
                {loading === "expand_fingerprint" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPinned className="h-3.5 w-3.5" />
                )}
                Expand this community’s map
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={Boolean(loading)}
                onClick={() => resolve("create_new_community")}
              >
                {loading === "create_new_community" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitBranch className="h-3.5 w-3.5" />
                )}
                Keep separate for later
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(loading)}
                onClick={() => resolve("dismiss")}
              >
                Not now
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
