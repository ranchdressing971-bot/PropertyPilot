import { NextRequest, NextResponse } from "next/server";
import { getAIInspection, saveAIInspection } from "@/lib/inspection-store";
import {
  deletePropertyFromDb,
  getAuthenticatedUserId,
  logAudit,
} from "@/lib/supabase/persist";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Remove an accidentally recorded home from an inspection (and property roster if present). */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limit = checkRateLimit(`delete-insp-property:${userId}`, 40, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many deletes. Wait a minute and try again." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId ?? "").trim();

  if (!propertyId) {
    return NextResponse.json(
      { error: "propertyId is required" },
      { status: 400 }
    );
  }

  const inspection = await getAIInspection(id);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const before = inspection.results.length;
  const results = inspection.results.filter((r) => r.propertyId !== propertyId);
  if (results.length === before) {
    return NextResponse.json(
      { error: "Property not found in inspection" },
      { status: 404 }
    );
  }

  const violations = (inspection.violations ?? []).filter(
    (v) => v.propertyId !== propertyId
  );
  const addressReviews = (inspection.addressReviews ?? []).filter(
    (r) => r.propertyId !== propertyId
  );

  const updated = {
    ...inspection,
    results,
    violations,
    addressReviews,
  };

  const saved = await saveAIInspection(updated);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error ?? "Could not update inspection" },
      { status: 500 }
    );
  }

  // Also remove from community/property roster if it was assigned
  await deletePropertyFromDb(userId, propertyId);

  await logAudit(userId, "inspection_property_delete", "inspection", id, {
    propertyId,
  });

  return NextResponse.json({
    ok: true,
    propertyId,
    remaining: results.length,
  });
}
