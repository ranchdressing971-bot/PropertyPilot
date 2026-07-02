"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Loader2 } from "lucide-react";
import { PLANS, type BillingPlan } from "@/lib/stripe-client";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function parsePlan(value: string | null): BillingPlan {
  return value === "professional" ? "professional" : "starter";
}

export function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = parsePlan(searchParams.get("plan"));
  const planInfo = PLANS[plan];
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(!stripePromise);

  // Hosted Stripe Checkout only needs STRIPE_SECRET_KEY (what you had before).
  useEffect(() => {
    if (stripePromise) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, embedded: false }),
        });
        const data = await res.json();
        if (res.status === 401) {
          router.push("/signup");
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Checkout unavailable");
        if (data.url && !cancelled) {
          window.location.href = data.url;
          return;
        }
        throw new Error("Checkout URL missing");
      } catch (err) {
        if (!cancelled) {
          setRedirecting(false);
          setError(err instanceof Error ? err.message : "Checkout unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan, router]);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, embedded: true }),
    });
    const data = await res.json();

    if (res.status === 401) {
      router.push("/signup");
      throw new Error("Sign in required");
    }
    if (!res.ok) {
      const message = data.error ?? "Checkout unavailable";
      setError(message);
      throw new Error(message);
    }
    if (!data.clientSecret) {
      setError("Checkout session could not be started.");
      throw new Error("Missing client secret");
    }
    return data.clientSecret as string;
  }, [plan, router]);

  if (!stripePromise) {
    return (
      <PublicLayout showNavActions={false}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-5">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm text-ink-500">
            {redirecting ? "Redirecting to secure checkout…" : "Loading checkout…"}
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout showNavActions={false}>
      <section className="mx-auto max-w-xl px-5 py-12 sm:py-16">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-brand-600">Subscribe</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            {planInfo.label} plan
          </h1>
          <p className="mt-2 text-ink-500">
            {planInfo.priceLabel} · billed monthly · cancel anytime in Settings
          </p>
        </div>

        {error ? (
          <div className="surface p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="surface overflow-hidden p-1 sm:p-2">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                fetchClientSecret,
                onComplete: () => {
                  router.push("/dashboard/settings?billing=success");
                },
              }}
            >
              <EmbeddedCheckout className="min-h-[480px]" />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          Secure payment by Stripe
        </p>
      </section>
    </PublicLayout>
  );
}

export function CheckoutPageFallback() {
  return (
    <PublicLayout showNavActions={false}>
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    </PublicLayout>
  );
}
