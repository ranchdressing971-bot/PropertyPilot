"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";
import { priceForCommunities, formatPriceMonthly } from "@/lib/stripe-client";

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
  hoaName?: string | null;
  communityTrialStatus?: string;
  accessReason?: string;
  canRunLiveInspection?: boolean;
}

export function BillingCard() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState<"checkout" | "portal" | "init" | null>("init");
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<SubStatus | null>(null);

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      toast("Billing updated — welcome aboard");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSub(data);
        setLoading(null);
      })
      .catch(() => setLoading(null));
  }, []);

  async function openPortal() {
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
                    ? ` · ${sub.communityCount} community${
                        sub.communityCount === 1 ? "" : "ies"
                      }`
                    : ""
                } · ${sub?.status}`
              : sub
                ? `${sub.trialInspectionsRemaining} of ${sub.trialInspectionsLimit} free inspection${
                    sub.trialInspectionsLimit === 1 ? "" : "s"
                  } left${sub.hoaName ? ` · ${sub.hoaName}` : ""}`
                : `1 free inspection per account, then from ${fromPrice}`}
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {subscribed ? (
          <Button variant="secondary" size="sm" onClick={openPortal} disabled={!!loading}>
            {loading === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Manage billing
          </Button>
        ) : (
          <Link href="/pricing">
            <Button size="sm">View pricing — from {fromPrice}</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
