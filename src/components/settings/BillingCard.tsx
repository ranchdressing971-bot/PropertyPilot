"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreditCard, Loader2, ExternalLink, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";
import { useAppMode } from "@/components/providers/AppModeProvider";
import {
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  upsellPriceForCommunities,
  FLAT_TIER_MAX_COMMUNITIES,
  FLAT_TIER_PRICE,
  MAX_COMMUNITIES,
} from "@/lib/stripe-client";

interface SubStatus {
  subscribed: boolean;
  status: string;
  plan: string | null;
  trialInspectionsUsed: number;
  trialInspectionsRemaining: number;
  trialInspectionsLimit: number;
  price: string;
  priceMonthly?: number;
  communityCount?: number;
  communitiesUsed?: number;
  communitiesLimit?: number;
  canCreateCommunity?: boolean;
  hoaName?: string | null;
  communityTrialStatus?: string;
  accessReason?: string;
  canRunLiveInspection?: boolean;
}

export function BillingCard() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isDemo } = useAppMode();
  const [loading, setLoading] = useState<
    "checkout" | "portal" | "upgrade" | "init" | null
  >("init");
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [addCount, setAddCount] = useState<number | null>(null);

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      toast("Billing updated. Welcome aboard");
    }
  }, [searchParams, toast]);

  function refreshStatus() {
    return fetch("/api/subscription/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSub(data);
          const current = Math.max(1, Number(data.communityCount) || 1);
          setAddCount((prev) =>
            prev == null || prev <= current
              ? clampCommunities(current + 1)
              : prev
          );
        }
        setLoading(null);
      })
      .catch(() => setLoading(null));
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const currentCount = Math.max(1, Number(sub?.communityCount) || 1);
  const targetCount = addCount ?? clampCommunities(currentCount + 1);
  const currentPrice =
    sub?.priceMonthly ?? priceForCommunities(currentCount);
  const nextPrice = useMemo(
    () => upsellPriceForCommunities(targetCount, currentPrice),
    [targetCount, currentPrice]
  );
  const priceDelta = Math.max(0, nextPrice - currentPrice);

  async function openPortal() {
    if (isDemo) {
      toast("Demo mode: billing portal is disabled");
      return;
    }
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Portal failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setLoading(null);
    }
  }

  async function upgradeCommunities() {
    if (isDemo) {
      toast("Demo mode: community upgrades are disabled");
      return;
    }
    if (targetCount <= currentCount) {
      setError("Choose a higher community count to upgrade.");
      return;
    }
    setLoading("upgrade");
    setError(null);
    try {
      const res = await fetch("/api/stripe/update-communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityCount: targetCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upgrade failed");
      toast(
        `Plan updated to ${data.communityCount} communit${
          data.communityCount === 1 ? "y" : "ies"
        } · ${data.priceLabel} (prorated)`
      );
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed");
      setLoading(null);
    }
  }

  if (loading === "init") {
    return (
      <Card>
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </Card>
    );
  }

  const subscribed = sub?.subscribed;
  const fromPrice = formatPriceMonthly(priceForCommunities(1));

  return (
    <Card>
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-ink-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-ink-900">Billing</h3>
          <p className="text-sm text-ink-500">
            {subscribed
              ? `${sub?.price ?? fromPrice}${
                  sub?.communityCount
                    ? ` · up to ${sub.communityCount} communit${
                        sub.communityCount === 1 ? "y" : "ies"
                      }`
                    : ""
                }${
                  sub?.communitiesUsed != null
                    ? ` · ${sub.communitiesUsed} in use`
                    : ""
                } · ${sub?.status}`
              : sub
                ? `${sub.trialInspectionsRemaining} of ${sub.trialInspectionsLimit} free inspection${
                    sub.trialInspectionsLimit === 1 ? "" : "s"
                  } left · 1 community on trial${
                    sub.hoaName ? ` (${sub.hoaName})` : ""
                  }`
                : `1 free inspection + 1 community on trial, then from ${fromPrice}`}
          </p>
        </div>
      </div>

      {!subscribed && sub?.communityTrialStatus === "claimed_by_other" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This community already used its free trial. Subscribe to run live
          inspections.
        </p>
      )}
      {!subscribed &&
        sub &&
        !sub.canRunLiveInspection &&
        sub.accessReason &&
        sub.communityTrialStatus !== "claimed_by_other" && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {sub.accessReason}
          </p>
        )}

      {subscribed && (
        <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Add communities
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-600">
            <li>
              ${FLAT_TIER_PRICE}/mo for 1-{FLAT_TIER_MAX_COMMUNITIES} communities
            </li>
            <li>Above that: volume pricing (see Pricing)</li>
            <li>Prorated for the rest of this period</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Fewer communities"
                onClick={() =>
                  setAddCount(clampCommunities(targetCount - 1))
                }
                disabled={targetCount <= currentCount + 1 || !!loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={currentCount + 1}
                max={MAX_COMMUNITIES}
                value={targetCount}
                disabled={!!loading}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setAddCount(
                    clampCommunities(Math.max(currentCount + 1, n))
                  );
                }}
                className="h-9 w-16 rounded-xl border border-ink-200 bg-white text-center text-sm font-semibold text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                aria-label="More communities"
                onClick={() =>
                  setAddCount(clampCommunities(targetCount + 1))
                }
                disabled={targetCount >= MAX_COMMUNITIES || !!loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-ink-900">
                {formatPriceMonthly(nextPrice)}
              </p>
              <p className="text-ink-500">
                {priceDelta > 0
                  ? `+$${priceDelta}/mo vs current`
                  : "Same monthly rate (more seats)"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={upgradeCommunities}
              disabled={!!loading || targetCount <= currentCount}
            >
              {loading === "upgrade" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Update to {targetCount} communit
              {targetCount === 1 ? "y" : "ies"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {subscribed ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={openPortal}
            disabled={!!loading}
          >
            {loading === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Manage billing
          </Button>
        ) : (
          <Link href="/pricing">
            <Button size="sm">View pricing, from {fromPrice}</Button>
          </Link>
        )}
      </div>
      {!subscribed && (
        <p className="mt-2 text-xs text-ink-400">
          From {fromPrice} for 1-{FLAT_TIER_MAX_COMMUNITIES} communities
        </p>
      )}
    </Card>
  );
}
