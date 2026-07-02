import { Suspense } from "react";
import { CheckoutPageClient, CheckoutPageFallback } from "./CheckoutPageClient";

export const metadata = {
  title: "Checkout — Property Pilot",
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutPageFallback />}>
      <CheckoutPageClient />
    </Suspense>
  );
}
