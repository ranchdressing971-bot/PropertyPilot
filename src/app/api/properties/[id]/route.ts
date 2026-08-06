import { NextRequest, NextResponse } from "next/server";
import {
  deletePropertyFromDb,
  getAuthenticatedUserId,
  logAudit,
} from "@/lib/supabase/persist";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limit = checkRateLimit(`delete-property:${userId}`, 40, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many deletes. Wait a minute and try again." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const propertyId = id.trim();
  if (!propertyId) {
    return NextResponse.json({ error: "Property id required" }, { status: 400 });
  }

  const result = await deletePropertyFromDb(userId, propertyId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await logAudit(userId, "property_delete", "property", propertyId, {});
  return NextResponse.json({ ok: true, id: propertyId });
}
