import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";
import { claimCommunityTrial } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/rate-limit";

/** Claim (or re-confirm) the free trial for a community name. */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limit = checkRateLimit(`claim-community:${userId}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts — wait a minute." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const hoaName = String(body.hoaName ?? "").trim();
  if (!hoaName) {
    return NextResponse.json(
      { error: "Community name is required" },
      { status: 400 }
    );
  }

  const result = await claimCommunityTrial(userId, hoaName);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "COMMUNITY_TRIAL_USED" ? 409 : 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    communityKey: result.communityKey,
    alreadyOwned: result.alreadyOwned,
  });
}
