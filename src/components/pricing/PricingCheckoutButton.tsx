"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

interface PricingCheckoutButtonProps {
  plan: "starter" | "professional";
  variant?: "primary" | "secondary";
  label: string;
}

export function PricingCheckoutButton({
  plan,
  variant = "primary",
  label,
}: PricingCheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/signup?plan=${plan}`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Checkout unavailable");
      if (data.url) window.location.href = data.url;
    } catch {
      router.push(`/signup?plan=${plan}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" variant={variant} onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
