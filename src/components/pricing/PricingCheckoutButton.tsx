"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface PricingCheckoutButtonProps {
  variant?: "primary" | "secondary";
  label: string;
  communities?: number;
}

export function PricingCheckoutButton({
  variant = "primary",
  label,
  communities = 1,
}: PricingCheckoutButtonProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/pricing/checkout?communities=${communities}`);
  }

  return (
    <Button className="w-full" variant={variant} onClick={handleClick}>
      {label}
    </Button>
  );
}
