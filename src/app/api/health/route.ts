import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { isOpenAIConfigured, isSupabaseConfigured } from "@/lib/app-mode";
import { isStripeConfigured } from "@/lib/stripe";
import { isResendConfigured } from "@/lib/resend";

export async function GET() {
  const supabase = isSupabaseConfigured();
  let openai = isOpenAIConfigured();
  let openaiMessage = openai ? "API key is set" : "OPENAI_API_KEY missing in environment";

  if (openai) {
    try {
      await getOpenAI().models.list();
      openaiMessage = "Connected — API key is valid";
    } catch (err) {
      openai = false;
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401") || msg.includes("Incorrect API key")) {
        openaiMessage = "Invalid API key — create a new key at platform.openai.com";
      } else if (msg.includes("429")) {
        openaiMessage = "Rate limit or billing issue — check OpenAI billing";
      } else {
        openaiMessage = msg;
      }
    }
  }

  return NextResponse.json({
    openai,
    supabase,
    stripe: isStripeConfigured(),
    resend: isResendConfigured(),
    openaiMessage,
    supabaseMessage: supabase
      ? "Supabase env vars detected"
      : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    stripeMessage: isStripeConfigured()
      ? "Stripe configured"
      : "Add STRIPE_SECRET_KEY for billing",
    resendMessage: isResendConfigured()
      ? "Resend configured"
      : "Add RESEND_API_KEY for email delivery",
  });
}
