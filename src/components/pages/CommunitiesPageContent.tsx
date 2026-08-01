"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCommunities } from "@/hooks/useCommunities";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  ArrowRight,
  Building2,
  Home,
  Loader2,
  Plus,
  Video,
} from "lucide-react";

export function CommunitiesPageContent() {
  const { isDemo } = useAppMode();
  const { communities, limit, loading, error, create } = useCommunities(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const result = await create(name);
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setName("");
    setShowCreate(false);
  }

  if (loading) {
    return (
      <PageContent>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {limit ? (
            <p className="text-sm text-ink-500">
              {limit.currentCount} of {limit.limit} communit
              {limit.limit === 1 ? "y" : "ies"} on your plan
              {!limit.subscribed && !isDemo ? " (trial)" : ""}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={limit ? !limit.canCreate : false}
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          New community
        </Button>
      </div>

      {limit && !limit.canCreate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {limit.reason ?? "Community limit reached."}{" "}
          <Link href="/pricing" className="font-medium underline">
            Adjust communities on Pricing
          </Link>
        </div>
      )}

      {showCreate && (
        <Card padding="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="community-name"
                className="text-sm font-medium text-ink-700"
              >
                Community name
              </label>
              <Input
                id="community-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Willow Creek Estates"
                required
                autoFocus
              />
              <p className="mt-1.5 text-xs text-ink-400">
                Inspections and properties for this HOA stay organized here.
              </p>
            </div>
            {createError && (
              <p className="text-sm text-red-600">
                {createError}{" "}
                {createError.toLowerCase().includes("plan") ||
                createError.toLowerCase().includes("subscribe") ||
                createError.toLowerCase().includes("limit") ? (
                  <Link href="/pricing" className="underline">
                    Open Pricing
                  </Link>
                ) : null}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create community"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {communities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-8 py-16 text-center shadow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-100">
            <Building2 className="h-6 w-6 text-brand-600" strokeWidth={1.75} />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-ink-900">
            No communities yet
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
            Create a community for each HOA you manage. Then upload
            drive-throughs and keep properties organized by community.
          </p>
          <Button
            className="mt-6"
            type="button"
            disabled={limit ? !limit.canCreate : false}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Create community
          </Button>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {communities.map((community) => (
            <motion.div key={community.id} variants={staggerItem}>
              <Link href={`/dashboard/communities/${community.id}`}>
                <Card hover className="h-full">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100">
                      <Building2 className="h-5 w-5 text-brand-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-semibold text-ink-900">
                        {community.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Home className="h-3.5 w-3.5" />
                          {community.propertyCount ?? 0} homes
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3.5 w-3.5" />
                          {community.inspectionCount ?? 0} inspections
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageContent>
  );
}

export function getCommunitiesSubtitle(
  isDemo: boolean,
  count: number,
  limit?: number | null
) {
  if (isDemo) {
    return `${count} sample communities · pick one to see properties`;
  }
  if (count === 0) return "Create a community for each HOA you manage";
  if (limit != null) {
    return `${count} of ${limit} communities · open one to see its properties`;
  }
  return `${count} communities · open one to see its properties`;
}
