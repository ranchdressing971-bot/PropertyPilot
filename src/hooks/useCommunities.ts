"use client";

import { useCallback, useEffect, useState } from "react";
import type { Community, CommunityLimitStatus } from "@/lib/communities";
import { DEMO_COMMUNITIES } from "@/lib/mock-data";
import { useAppMode } from "@/components/providers/AppModeProvider";

export type CommunityListItem = Community;

interface LimitPayload {
  currentCount: number;
  limit: number;
  canCreate: boolean;
  subscribed: boolean;
  reason?: string;
  code?: string;
}

export function useCommunities(enabled = true) {
  const { isDemo } = useAppMode();
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [limit, setLimit] = useState<LimitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (isDemo) {
      setCommunities(DEMO_COMMUNITIES);
      setLimit({
        currentCount: DEMO_COMMUNITIES.length,
        limit: 5,
        canCreate: DEMO_COMMUNITIES.length < 5,
        subscribed: true,
      });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/communities", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load communities");
      }
      setCommunities(data.communities ?? []);
      setLimit(data.limit ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load communities");
    } finally {
      setLoading(false);
    }
  }, [enabled, isDemo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      if (isDemo) {
        const id = `demo-${Date.now()}`;
        const community: CommunityListItem = {
          id,
          name: name.trim(),
          communityKey: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
          companyId: null,
          userId: "demo",
          createdAt: new Date().toISOString(),
          propertyCount: 0,
          inspectionCount: 0,
        };
        setCommunities((prev) => [...prev, community]);
        setLimit((prev) =>
          prev
            ? {
                ...prev,
                currentCount: prev.currentCount + 1,
                canCreate: prev.currentCount + 1 < prev.limit,
              }
            : prev
        );
        return { ok: true as const, community };
      }

      const res = await fetch("/api/communities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false as const,
          error: data.error as string,
          code: data.code as string | undefined,
        };
      }
      await refresh();
      return { ok: true as const, community: data.community as Community };
    },
    [isDemo, refresh]
  );

  return { communities, limit, loading, error, refresh, create };
}

export type { CommunityLimitStatus };
