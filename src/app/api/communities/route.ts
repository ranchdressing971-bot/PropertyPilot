import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCommunity,
  getCommunityLimitStatus,
  listCommunitiesForUser,
} from "@/lib/communities";
import { checkRateLimit } from "@/lib/rate-limit";

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

  const [communities, limit] = await Promise.all([
    listCommunitiesForUser(user.id),
    getCommunityLimitStatus(user.id),
  ]);

  return NextResponse.json({
    communities,
    limit: {
      currentCount: limit.currentCount,
      limit: limit.limit,
      canCreate: limit.canCreate,
      subscribed: limit.subscribed,
      reason: limit.reason,
      code: limit.code,
    },
  });
}

export async function POST(request: NextRequest) {
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

  const rl = checkRateLimit(`communities-create:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly.", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Community name is required", code: "INVALID_COMMUNITY" },
      { status: 400 }
    );
  }

  const result = await createCommunity(user.id, name);
  if (!result.ok) {
    const status =
      result.code === "COMMUNITY_LIMIT"
        ? 402
        : result.code === "INVALID_COMMUNITY"
          ? 400
          : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status }
    );
  }

  const limit = await getCommunityLimitStatus(user.id);
  return NextResponse.json({
    community: result.community,
    created: result.created,
    limit: {
      currentCount: limit.currentCount,
      limit: limit.limit,
      canCreate: limit.canCreate,
      subscribed: limit.subscribed,
    },
  });
}
