import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";
import {
  resolveCommunityVerification,
  type VerificationResolution,
} from "@/lib/community-verification";

const VALID: VerificationResolution[] = [
  "confirm_new_homes",
  "ignore_new_homes",
  "expand_fingerprint",
  "create_new_community",
  "dismiss",
];

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  let body: {
    eventId?: string;
    resolution?: string;
    communityName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = body.eventId?.trim();
  const resolution = body.resolution as VerificationResolution | undefined;
  if (!eventId || !resolution || !VALID.includes(resolution)) {
    return NextResponse.json(
      { error: "eventId and a valid resolution are required" },
      { status: 400 }
    );
  }

  const result = await resolveCommunityVerification({
    eventId,
    userId,
    resolution,
    communityName: body.communityName,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Could not save" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, message: result.message });
}
