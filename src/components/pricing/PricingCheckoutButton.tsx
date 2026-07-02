"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { BillingPlan } from "@/lib/stripe-client";

interface PricingCheckoutButtonProps {
  variant?: "primary" | "secondary";
  label: string;
  plan?: BillingPlan;
}

export function PricingCheckoutButton({
  variant = "primary",
  label,
  plan = "starter",
}: PricingCheckoutButtonProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/pricing/checkout?plan=${plan}`);
  }

  return (
    <Button className="w-full" variant={variant} onClick={handleClick}>
      {label}
    </Button>
  );
}
