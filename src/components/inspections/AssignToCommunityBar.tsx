"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  CommunityPicker,
  type SelectedCommunity,
} from "@/components/communities/CommunityPicker";
import { CheckSquare, Loader2, Square } from "lucide-react";
import clsx from "clsx";

interface AssignableProperty {
  id: string;
  address: string;
  image?: string;
}

interface AssignToCommunityBarProps {
  inspectionId: string;
  neighborhood: string;
  properties: AssignableProperty[];
  communityIdHint?: string | null;
}

export function AssignToCommunityBar({
  inspectionId,
  properties,
  communityIdHint,
}: AssignToCommunityBarProps) {
  const { isDemo } = useAppMode();
  const [community, setCommunity] = useState<SelectedCommunity | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"all" | "selected" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCommunityChange = useCallback((c: SelectedCommunity) => {
    setCommunity(c);
    setMessage(null);
    setError(null);
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assign(mode: "all" | "selected") {
    if (!community) {
      setError("Pick or create a community first, then add these homes.");
      return;
    }
    setBusy(mode);
    setError(null);
    setMessage(null);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 400));
      const count =
        mode === "all" ? properties.length : selected.size || properties.length;
      setMessage(
        `Added ${count} home${count === 1 ? "" : "s"} to ${community.name} (demo).`
      );
      setBusy(null);
      setSelectMode(false);
      return;
    }

    try {
      const body =
        mode === "all"
          ? { inspectionId, addAll: true }
          : {
              inspectionId,
              propertyIds: Array.from(selected),
              properties: properties
                .filter((p) => selected.has(p.id))
                .map((p) => ({
                  id: p.id,
                  address: p.address,
                  image: p.image ?? "",
                })),
            };

      const res = await fetch(`/api/communities/${community.id}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign properties");
      setMessage(
        `Added ${data.assigned} home${data.assigned === 1 ? "" : "s"} to ${community.name}.`
      );
      setSelectMode(false);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  }

  if (properties.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-4">
      <CommunityPicker
        value={community}
        onChange={onCommunityChange}
        preferredId={communityIdHint}
        title="Add these homes to a community"
        description="After your inspection, pick an existing community or create a new one (within your plan), then add the homes below."
        embedded
        autoSelect
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-brand-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-500">
          {community
            ? `Ready to save addresses to ${community.name}.`
            : "Choose a community above to continue."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!community || busy !== null}
            onClick={() => void assign("all")}
          >
            {busy === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add all"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!community || busy !== null}
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
              setMessage(null);
              setError(null);
            }}
          >
            {selectMode ? "Cancel select" : "Select"}
          </Button>
        </div>
      </div>

      {selectMode && (
        <div className="mt-4 space-y-2">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2">
            {properties.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                    on
                      ? "bg-ink-900 text-white"
                      : "text-ink-800 hover:bg-ink-50"
                  )}
                >
                  {on ? (
                    <CheckSquare className="h-4 w-4 shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-ink-400" />
                  )}
                  <span className="truncate">{p.address}</span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selected.size === 0 || busy !== null}
            onClick={() => void assign("selected")}
          >
            {busy === "selected" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Add ${selected.size} selected`
            )}
          </Button>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm text-brand-800">
          {message}{" "}
          {community && (
            <Link
              href={`/dashboard/communities/${community.id}`}
              className="font-medium underline"
            >
              View community
            </Link>
          )}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
