import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canRunLiveInspection,
  getTrialScanUsage,
  getUserSubscription,
  hasActiveSubscription,
} from "@/lib/subscription";
import { FREE_TRIAL_SCANS, isStripeConfigured, PLAN_PRICE_LABEL } from "@/lib/stripe";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const sub = await getUserSubscription(user.id);
  const trial = await getTrialScanUsage(user.id);
  const access = await canRunLiveInspection(user.id);

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    subscribed: hasActiveSubscription(sub.status),
    status: sub.status,
    plan: sub.plan,
    price: PLAN_PRICE_LABEL,
    trialScansLimit: FREE_TRIAL_SCANS,
    trialScansUsed: trial.used,
    trialScansRemaining: trial.remaining,
    canRunLiveInspection: access.allowed,
  });
}
