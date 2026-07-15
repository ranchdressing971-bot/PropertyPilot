import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canRunLiveInspection,
  getCommunityTrialStatus,
  getTrialInspectionUsage,
  getUserSubscription,
  hasActiveSubscription,
} from "@/lib/subscription";
import {
  FREE_TRIAL_INSPECTIONS,
  formatPriceMonthly,
  isStripeConfigured,
  priceForCommunities,
} from "@/lib/stripe";

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
  const trial = await getTrialInspectionUsage(user.id);
  const access = await canRunLiveInspection(user.id);
  const community = await getCommunityTrialStatus(user.id, sub.hoaName);

  const communityCount = sub.communityCount || 1;
  const priceMonthly =
    sub.priceMonthly ?? priceForCommunities(communityCount);

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    subscribed: hasActiveSubscription(sub.status),
    status: sub.status,
    plan: sub.plan,
    communityCount,
    priceMonthly,
    price: formatPriceMonthly(priceMonthly),
    hoaName: sub.hoaName,
    communityKey: sub.communityKey,
    communityTrialStatus: community.status,
    trialInspectionsLimit: FREE_TRIAL_INSPECTIONS,
    trialInspectionsUsed: trial.used,
    trialInspectionsRemaining: trial.remaining,
    trialScansLimit: FREE_TRIAL_INSPECTIONS,
    trialScansUsed: trial.used,
    trialScansRemaining: trial.remaining,
    canRunLiveInspection: access.allowed,
    accessReason: access.reason,
    accessCode: access.code,
  });
}
