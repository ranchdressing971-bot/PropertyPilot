"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Loader2 } from "lucide-react";
import {
  clampCommunities,
  formatPriceMonthly,
  priceForCommunities,
  upsellPriceForCommunities,
  FLAT_TIER_MAX_COMMUNITIES,
  FLAT_TIER_PRICE,
  PRICING_BASE,
  PRICING_EXPONENT,
} from "@/lib/stripe-client";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const communities = useMemo(
    () =>
      clampCommunities(
        Number(
          searchParams.get("communities") ??
            searchParams.get("communityCount") ??
            1
        )
      ),
    [searchParams]
  );
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "checkout" | "done">(
    "loading"
  );
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [currentPriceMonthly, setCurrentPriceMonthly] = useState<number | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscription/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.subscribed) {
          setAlreadySubscribed(true);
          if (data.priceMonthly != null) {
            setCurrentPriceMonthly(Number(data.priceMonthly));
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const priceMonthly = useMemo(() => {
    if (alreadySubscribed) {
      return upsellPriceForCommunities(
        communities,
        currentPriceMonthly ?? priceForCommunities(1)
      );
    }
    return priceForCommunities(communities);
  }, [alreadySubscribed, communities, currentPriceMonthly]);
  const priceLabel = formatPriceMonthly(priceMonthly);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const embedded = Boolean(stripePromise);
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ communityCount: communities, embedded }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (res.status === 401) {
          router.push(
            `/signup?next=${encodeURIComponent(`/pricing/checkout?communities=${communities}`)}`
          );
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Checkout unavailable");

        if (data.updated) {
          setStatus("done");
          window.location.href =
            (data.redirectUrl as string) ||
            "/dashboard/settings?billing=success";
          return;
        }

        if (data.clientSecret) {
          setClientSecret(data.clientSecret as string);
          setStatus("checkout");
          return;
        }

        if (data.url) {
          setStatus("done");
          window.location.href = data.url as string;
          return;
        }

        throw new Error("Checkout session could not be started.");
      } catch (err) {
        if (!cancelled) {
          setStatus("checkout");
          setError(err instanceof Error ? err.message : "Checkout unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [communities, router]);

  if (status === "loading" || status === "done") {
    return (
      <PublicLayout showNavActions={false}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-5">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm text-ink-500">
            {status === "done"
              ? "Updating your plan…"
              : stripePromise
                ? "Preparing secure checkout…"
                : "Redirecting to secure checkout…"}
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
          <p className="text-sm font-medium text-brand-600">
            {alreadySubscribed ? "Add communities" : "Subscribe"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
            {communities === 1
              ? "1 community"
              : `${communities} communities`}
          </h1>
          <p className="mt-2 text-ink-500">
            {priceLabel} · billed monthly · cancel anytime in Settings
          </p>
        </div>

        {error || !clientSecret || !stripePromise ? (
          <div className="surface p-6 text-center text-sm text-red-600">
            {error ?? "Checkout unavailable"}
          </div>
        ) : (
          <div className="surface overflow-hidden p-1 sm:p-2">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                clientSecret,
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
          Secure payment by Stripe · ${FLAT_TIER_PRICE}/mo for 1-
          {FLAT_TIER_MAX_COMMUNITIES}; then max(${FLAT_TIER_PRICE}, round($
          {PRICING_BASE} × c<sup>{PRICING_EXPONENT}</sup>))
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
