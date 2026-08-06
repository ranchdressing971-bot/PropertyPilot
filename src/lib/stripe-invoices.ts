import Stripe from "stripe";

export function isStripeTestConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return Boolean(secret?.startsWith("sk_test_") && pub?.startsWith("pk_test_"));
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
