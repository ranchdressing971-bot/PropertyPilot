"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCommunities } from "@/hooks/useCommunities";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Building2, Loader2, Plus } from "lucide-react";
import clsx from "clsx";

export interface SelectedCommunity {
  id: string;
  name: string;
}

interface CommunityPickerProps {
  value: SelectedCommunity | null;
  onChange: (community: SelectedCommunity) => void;
  /** Prefill from ?community= query when present */
  preferredId?: string | null;
}

export function CommunityPicker({
  value,
  onChange,
  preferredId,
}: CommunityPickerProps) {
  const { communities, limit, loading, create } = useCommunities(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || communities.length === 0) return;
    if (value) return;

    const preferred = preferredId
      ? communities.find((c) => c.id === preferredId)
      : null;
    const pick = preferred ?? communities[0];
    if (pick) onChange({ id: pick.id, name: pick.name });
  }, [loading, communities, value, preferredId, onChange]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const result = await create(newName);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange({ id: result.community.id, name: result.community.name });
    setNewName("");
    setShowNew(false);
  }

  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink-900">
          Which community is this inspection for?
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          {communities.length <= 1
            ? "Use your existing community, or create a new one if your plan allows."
            : "Pick a community you already manage, or create another (within your plan)."}
        </p>
      </div>

      {limit && (
        <p className="text-xs text-ink-400">
          {limit.currentCount} of {limit.limit} communities used
          {!limit.subscribed ? " · trial includes 1" : ""}
        </p>
      )}

      <div className="space-y-2">
        {communities.map((c) => {
          const active = value?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange({ id: c.id, name: c.name })}
              className={clsx(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50"
              )}
            >
              <Building2
                className={clsx(
                  "h-4 w-4 shrink-0",
                  active ? "text-brand-300" : "text-ink-400"
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {c.name}
              </span>
              <span
                className={clsx(
                  "text-xs",
                  active ? "text-ink-300" : "text-ink-400"
                )}
              >
                {c.propertyCount ?? 0} homes
              </span>
            </button>
          );
        })}
      </div>

      {showNew ? (
        <form onSubmit={handleCreate} className="space-y-3 border-t border-ink-100 pt-4">
          <div>
            <label
              htmlFor="new-community"
              className="text-sm font-medium text-ink-700"
            >
              New community name
            </label>
            <Input
              id="new-community"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Oak Ridge Village"
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">
              {error}{" "}
              {(error.toLowerCase().includes("limit") ||
                error.toLowerCase().includes("subscribe") ||
                error.toLowerCase().includes("plan")) && (
                <Link href="/pricing" className="underline">
                  Pricing
                </Link>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNew(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={limit ? !limit.canCreate : false}
            onClick={() => setShowNew(true)}
          >
            <Plus className="h-4 w-4" />
            Create new community
          </Button>
          {limit && !limit.canCreate && (
            <Link
              href="/pricing"
              className="text-sm font-medium text-brand-800 underline"
            >
              Increase community count
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
