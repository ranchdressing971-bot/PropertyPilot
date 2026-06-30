"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";

interface SubStatus {
  subscribed: boolean;
  status: string;
  trialScansUsed: number;
  trialScansRemaining: number;
  trialScansLimit: number;
  price: string;
}

export function BillingCard() {
  const [loading, setLoading] = useState<"checkout" | "portal" | "init" | null>("init");
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<SubStatus | null>(null);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSub(data);
        setLoading(null);
      })
      .catch(() => setLoading(null));
  }, []);

  async function startCheckout() {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

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

  return (
    <Card>
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-ink-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-ink-900">Billing</h3>
          <p className="text-sm text-ink-500">
            {subscribed
              ? `${sub?.price ?? "$149/mo"} · ${sub?.status}`
              : sub
                ? `${sub.trialScansRemaining} of ${sub.trialScansLimit} free scans left · then ${sub.price}`
                : "$149/mo after 3 free scans"}
          </p>
        </div>
      </div>

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
          <Button size="sm" onClick={startCheckout} disabled={!!loading}>
            {loading === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Subscribe — $149/mo
          </Button>
        )}
      </div>
    </Card>
  );
}
