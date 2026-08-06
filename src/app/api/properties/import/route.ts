import { NextRequest, NextResponse } from "next/server";
import { parseCsvRoster, normalizeRosterIds } from "@/lib/roster";
import {
  getAuthenticatedUserId,
  persistProperties,
  logAudit,
} from "@/lib/supabase/persist";
import { getCommunityById } from "@/lib/communities";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const csv = body.csv as string;
  let neighborhood = (body.neighborhood as string) || "Your Community";
  const communityId =
    typeof body.communityId === "string" ? body.communityId : undefined;

  if (!csv?.trim()) {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }

  if (communityId) {
    const community = await getCommunityById(userId, communityId);
    if (community) neighborhood = community.name;
  }

  const parsed = normalizeRosterIds(parseCsvRoster(csv, neighborhood)).map(
    (p) => ({
      ...p,
      neighborhood,
      ...(communityId ? { communityId } : {}),
    })
  );

  await persistProperties(userId, parsed);
  await logAudit(userId, "roster_import", "properties", "bulk", {
    count: parsed.length,
    communityId,
  });

  return NextResponse.json({ properties: parsed, count: parsed.length });
}
