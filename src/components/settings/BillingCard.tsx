"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

export function BillingCard() {
  const [loading, setLoading] = useState<"checkout" | "portal" | "init" | null>("init");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseClientConfigured()) {
      setLoading(null);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(null);
        return;
      }
      supabase
        .from("profiles")
        .select("subscription_status, plan")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setStatus(data?.subscription_status ?? "trialing");
          setPlan(data?.plan ?? "starter");
          setLoading(null);
        });
    });
  }, []);

  async function startCheckout(plan: "starter" | "professional") {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
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

  const active = status === "active" || status === "trialing";

  if (loading === "init") {
    return (
      <Card>
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-ink-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-ink-900">Billing</h3>
          <p className="text-sm text-ink-500">
            {active
              ? `${plan ?? "Starter"} plan · ${status}`
              : "Start a 14-day free trial for live AI inspections"}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {active ? (
          <Button variant="secondary" size="sm" onClick={openPortal} disabled={!!loading}>
            {loading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage billing
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => startCheckout("starter")} disabled={!!loading}>
              {loading === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start trial — Starter
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startCheckout("professional")}
              disabled={!!loading}
            >
              Professional
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
