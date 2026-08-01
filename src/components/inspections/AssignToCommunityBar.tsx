"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useCommunities } from "@/hooks/useCommunities";
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
  neighborhood,
  properties,
  communityIdHint,
}: AssignToCommunityBarProps) {
  const { isDemo } = useAppMode();
  const { communities, loading } = useCommunities(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"all" | "selected" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const community = useMemo(() => {
    if (communityIdHint) {
      const byId = communities.find((c) => c.id === communityIdHint);
      if (byId) return byId;
    }
    const byName = communities.find(
      (c) => c.name.trim().toLowerCase() === neighborhood.trim().toLowerCase()
    );
    return byName ?? communities[0] ?? null;
  }, [communities, communityIdHint, neighborhood]);

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
      setError("Create a community first, then assign these homes.");
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

  if (loading || properties.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink-900">
            Add homes to{" "}
            {community ? (
              <Link
                href={`/dashboard/communities/${community.id}`}
                className="underline"
              >
                {community.name}
              </Link>
            ) : (
              "a community"
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Save discovered addresses to this community&apos;s property list.
          </p>
        </div>
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
                    on ? "bg-ink-900 text-white" : "hover:bg-ink-50 text-ink-800"
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
      {!community && (
        <p className="mt-3 text-sm text-amber-800">
          <Link href="/dashboard/communities" className="underline">
            Create a community
          </Link>{" "}
          first to organize these properties.
        </p>
      )}
    </div>
  );
}
