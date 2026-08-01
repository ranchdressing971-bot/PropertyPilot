import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCommunityById,
  loadPropertiesForCommunity,
} from "@/lib/communities";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const community = await getCommunityById(user.id, id);
  if (!community) {
    return NextResponse.json(
      { error: "Community not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const properties = await loadPropertiesForCommunity(user.id, community);
  return NextResponse.json({ community, properties });
}
