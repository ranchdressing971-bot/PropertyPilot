import { NextRequest, NextResponse } from "next/server";
import { getAIInspection, saveAIInspection } from "@/lib/inspection-store";
import {
  getAuthenticatedUserId,
  logAudit,
} from "@/lib/supabase/persist";
import { extractHouseNumber, formatAddressTitle } from "@/lib/address-normalize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const propertyId = String(body.propertyId ?? "").trim();
  const rawAddress = String(body.address ?? "").trim();

  if (!propertyId || !rawAddress) {
    return NextResponse.json(
      { error: "propertyId and address are required" },
      { status: 400 }
    );
  }

  if (!extractHouseNumber(rawAddress)) {
    return NextResponse.json(
      { error: "Address must start with a house number (e.g. 456 Oak Lane)" },
      { status: 400 }
    );
  }

  const address = formatAddressTitle(rawAddress);
  const inspection = await getAIInspection(id);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const resultIdx = inspection.results.findIndex((r) => r.propertyId === propertyId);
  if (resultIdx === -1) {
    return NextResponse.json(
      { error: "Property not found in inspection" },
      { status: 404 }
    );
  }

  inspection.results[resultIdx] = {
    ...inspection.results[resultIdx],
    address,
  };

  const reviews = [...(inspection.addressReviews ?? [])];
  const reviewIdx = reviews.findIndex((r) => r.propertyId === propertyId);
  const confirmed = {
    propertyId,
    address,
    confidence: 100,
    needsReview: false,
    reasoning: "Confirmed by manager",
  };
  if (reviewIdx >= 0) {
    reviews[reviewIdx] = { ...reviews[reviewIdx], ...confirmed };
  } else {
    reviews.push(confirmed);
  }
  inspection.addressReviews = reviews;

  const saved = await saveAIInspection(inspection);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error ?? "Could not save confirmation" },
      { status: 500 }
    );
  }

  await logAudit(userId, "address_confirm", "inspection", id, {
    propertyId,
    address,
  });

  return NextResponse.json({ ok: true, address, propertyId });
}
