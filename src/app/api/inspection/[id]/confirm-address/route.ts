import { NextRequest, NextResponse } from "next/server";
import { getAIInspection, saveAIInspection } from "@/lib/inspection-store";
import {
  getAuthenticatedUserId,
  loadPropertiesFromDb,
  logAudit,
} from "@/lib/supabase/persist";
import {
  addressDedupeKey,
  extractHouseNumber,
  streetCore,
} from "@/lib/address-normalize";
import { validateStreetAddress } from "@/lib/geo/validate-address";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limit = checkRateLimit(`confirm-address:${userId}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many address checks — wait a minute and try again." },
      { status: 429 }
    );
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

  const roster = await loadPropertiesFromDb(userId);
  const inputKey = addressDedupeKey(rawAddress);
  const inputNum = extractHouseNumber(rawAddress);
  const inputStreet = streetCore(rawAddress);

  const rosterHit = roster.find((p) => {
    if (addressDedupeKey(p.address) === inputKey) return true;
    const pNum = extractHouseNumber(p.address);
    const pStreet = streetCore(p.address);
    return (
      Boolean(inputNum) &&
      pNum === inputNum &&
      Boolean(inputStreet) &&
      Boolean(pStreet) &&
      (pStreet === inputStreet ||
        pStreet.includes(inputStreet) ||
        inputStreet.includes(pStreet))
    );
  });

  let address: string;
  let verified = false;
  let displayName: string | undefined;
  let source: "roster" | "map" = "map";

  if (rosterHit) {
    address = rosterHit.address;
    verified = true;
    source = "roster";
  } else {
    // Require a real map hit — don't save made-up addresses
    const validation = await validateStreetAddress(rawAddress, {
      neighborhood: inspection.neighborhood,
      allowUnverified: false,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error ?? "Invalid address" },
        { status: 400 }
      );
    }

    if (!validation.verified) {
      return NextResponse.json(
        {
          error:
            "Could not verify that address on the map. Check spelling, or add it to your Properties roster first.",
        },
        { status: 400 }
      );
    }

    address = validation.address;
    verified = true;
    displayName = validation.displayName;
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
    reasoning:
      source === "roster"
        ? "Confirmed — matches community roster"
        : "Confirmed — verified as a real street address",
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
    verified,
    source,
    displayName,
  });

  return NextResponse.json({
    ok: true,
    address,
    propertyId,
    verified,
    source,
    displayName,
  });
}
