import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI } from "@/lib/openai";
import { isOpenAIConfigured, isSupabaseConfigured } from "@/lib/app-mode";
import { isStripeConfigured } from "@/lib/stripe";
import { isResendConfigured } from "@/lib/resend";

export async function GET() {
  const supabase = isSupabaseConfigured();
  const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let openai = isOpenAIConfigured();
  let openaiMessage = openai ? "API key is set" : "OPENAI_API_KEY missing in environment";

  let supabaseMessage = supabase
    ? "Supabase URL + anon key detected"
    : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY";

  if (supabase && !serviceRole) {
    supabaseMessage =
      "Missing SUPABASE_SERVICE_ROLE_KEY — inspections may not save. Add it in Vercel env vars.";
  }

  if (supabase && serviceRole) {
    const admin = createAdminClient();
    if (admin) {
      const { error } = await admin
        .from("inspections")
        .select("id", { count: "exact", head: true });
      if (error) {
        supabaseMessage = `Database error: ${error.message}. Run docs/FIX_SUPABASE.sql in Supabase.`;
      } else {
        supabaseMessage = "Supabase connected — inspections table OK";
      }
    }
  }

  if (openai) {
    try {
      await getOpenAI().models.list();
      openaiMessage = "Connected — API key is valid";
    } catch (err) {
      openai = false;
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401") || msg.includes("Incorrect API key")) {
        openaiMessage =
          "Invalid API key — create a new key at platform.openai.com. " +
          "In Vercel, paste the key with no quotes or extra spaces, then redeploy.";
      } else if (msg.includes("429")) {
        openaiMessage = "Rate limit or billing issue — check OpenAI billing";
      } else {
        openaiMessage = msg;
      }
    }
  }

  return NextResponse.json({
    openai,
    supabase: supabase && serviceRole,
    serviceRole,
    stripe: isStripeConfigured(),
    resend: isResendConfigured(),
    openaiMessage,
    supabaseMessage,
    serviceRoleMessage: serviceRole
      ? "Service role key set"
      : "Add SUPABASE_SERVICE_ROLE_KEY from Supabase → Settings → API",
    stripeMessage: isStripeConfigured()
      ? "Stripe configured"
      : "Add STRIPE_SECRET_KEY for billing",
    resendMessage: isResendConfigured()
      ? "Resend configured"
      : "Add RESEND_API_KEY for email delivery",
  });
}
