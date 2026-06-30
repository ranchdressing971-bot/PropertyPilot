import { NextRequest, NextResponse } from "next/server";
import { listAIInspectionsAsync, updateViolationStatus, ensureStoreHydrated } from "@/lib/inspection-store";
import { isLiveModeFromCookie } from "@/lib/get-mode";
import { getLiveViolation } from "@/lib/live-data";
import { getViolation, getProperty } from "@/lib/mock-data";
import { getAuthenticatedUserId, logAudit } from "@/lib/supabase/persist";
import type { ViolationStatus, Violation } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function findPropertyAddress(propertyId: string, aiPowered: boolean): Promise<string | null> {
  if (aiPowered) {
    const inspections = await listAIInspectionsAsync();
    for (const insp of inspections) {
      const result = insp.results.find((r: { propertyId: string; address: string }) => r.propertyId === propertyId);
      if (result) return result.address;
    }
    return null;
  }
  return getProperty(propertyId)?.address ?? null;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const isLive = isLiveModeFromCookie(request.headers.get("cookie"));

  await ensureStoreHydrated();
  const inspections = await listAIInspectionsAsync();

  for (const inspection of inspections) {
    const violation = inspection.violations.find((v: Violation) => v.id === id);
    if (violation) {
      return NextResponse.json({
        violation,
        aiPowered: true,
        inspectionId: inspection.id,
        propertyAddress: await findPropertyAddress(violation.propertyId, true),
      });
    }
  }

  if (isLive) {
    const live = getLiveViolation(id);
    if (live) {
      return NextResponse.json({
        violation: live,
        aiPowered: true,
        propertyAddress: await findPropertyAddress(live.propertyId, true),
      });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const violation = getViolation(id);
  if (violation) {
    return NextResponse.json({
      violation,
      aiPowered: false,
      propertyAddress: getProperty(violation.propertyId)?.address,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status as ViolationStatus;

  if (!["pending", "approved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateViolationStatus(id, status);
  if (!updated) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  const userId = await getAuthenticatedUserId();
  if (userId) {
    await logAudit(userId, `violation_${status}`, "violation", id);
  }

  await ensureStoreHydrated();
  const inspections = await listAIInspectionsAsync();
  for (const inspection of inspections) {
    const violation = inspection.violations.find((v: Violation) => v.id === id);
    if (violation) {
      return NextResponse.json({ violation: { ...violation, status } });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
