import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assignPropertiesToCommunity,
  getCommunityById,
} from "@/lib/communities";
import { loadInspectionFromDbById } from "@/lib/supabase/persist";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
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

  const rl = checkRateLimit(`communities-assign:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly.", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }

  const { id: communityId } = await params;
  const community = await getCommunityById(user.id, communityId);
  if (!community) {
    return NextResponse.json(
      { error: "Community not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const inspectionId =
    typeof body?.inspectionId === "string" ? body.inspectionId : undefined;
  const propertyIds = Array.isArray(body?.propertyIds)
    ? (body.propertyIds as string[]).filter((x) => typeof x === "string")
    : [];
  const addAll = Boolean(body?.addAll);

  let properties: Array<{
    id: string;
    address: string;
    image?: string;
  }> = [];

  if (Array.isArray(body?.properties) && body.properties.length > 0) {
    properties = body.properties
      .map((p: { id?: string; address?: string; image?: string }) => ({
        id: String(p.id ?? ""),
        address: String(p.address ?? "").trim(),
        image: typeof p.image === "string" ? p.image : "",
      }))
      .filter((p: { id: string; address: string }) => p.id && p.address);
  } else if (inspectionId) {
    const inspection = await loadInspectionFromDbById(user.id, inspectionId);
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found", code: "INSPECTION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const fromResults = inspection.results.map((r) => {
      const img = inspection.propertyImages?.[r.propertyId] ?? "";
      return {
        id: r.propertyId,
        address: r.address,
        image: img,
      };
    });

    if (addAll || propertyIds.length === 0) {
      properties = fromResults;
    } else {
      const allow = new Set(propertyIds);
      properties = fromResults.filter((p) => allow.has(p.id));
    }
  } else if (propertyIds.length > 0) {
    return NextResponse.json(
      {
        error: "Pass properties[] or inspectionId with propertyIds.",
        code: "INVALID_BODY",
      },
      { status: 400 }
    );
  }

  if (properties.length === 0) {
    return NextResponse.json(
      { error: "No properties to assign", code: "EMPTY" },
      { status: 400 }
    );
  }

  const result = await assignPropertiesToCommunity({
    userId: user.id,
    communityId,
    properties,
    inspectionId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    assigned: result.assigned,
    communityId,
    communityName: community.name,
  });
}
