import { NextResponse } from "next/server";
import { formatInspectionForDisplay } from "@/lib/inspection-display";
import { getAIInspection, reloadStoreFromDb } from "@/lib/inspection-store";
import { isLiveModeFromCookie } from "@/lib/get-mode";
import {
  getInspection,
  getProperty,
  properties,
  type Violation,
} from "@/lib/mock-data";
import {
  DEFAULT_COLLECTION_DAYS,
  formatCollectionDays,
  shouldEnforceTrashBins,
  type Weekday,
} from "@/lib/trash-collection";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function applyTrashScheduleToDemoResults(
  results: { propertyId: string; violation: Violation | null }[],
  collectionDays: Weekday[]
) {
  if (shouldEnforceTrashBins(collectionDays)) return results;

  return results.map((r) => {
    if (r.violation?.type !== "Trash Bin Visible") return r;
    return { ...r, violation: null };
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const isLive = isLiveModeFromCookie(request.headers.get("cookie"));

  await reloadStoreFromDb();
  const aiInspection = await getAIInspection(id);
  if (aiInspection) {
    return NextResponse.json(formatInspectionForDisplay(aiInspection));
  }

  if (isLive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inspection = getInspection(id);
  if (inspection) {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("collectionDays");
    const collectionDays: Weekday[] = daysParam
      ? (daysParam.split(",").filter(Boolean) as Weekday[])
      : DEFAULT_COLLECTION_DAYS;

    const baseResults = inspection.results.length
      ? inspection.results
      : properties.map((p) => ({ propertyId: p.id, violation: null }));

    const filtered = applyTrashScheduleToDemoResults(baseResults, collectionDays);
    const withProps = filtered.map((r) => {
      const prop = getProperty(r.propertyId);
      // If trash was suppressed, show clean standing on the card
      if (!r.violation && prop?.status === "Needs Review" && prop.id === "prop-1") {
        return {
          ...r,
          property: { ...prop, status: "Good Standing" as const },
        };
      }
      return { ...r, property: prop };
    });

    const violationsFound = withProps.filter((r) => r.violation).length;

    return NextResponse.json({
      ...inspection,
      violationsFound,
      aiPowered: false,
      trashCollectionDays: collectionDays,
      trashScheduleNote: shouldEnforceTrashBins(collectionDays)
        ? `Trash bins can be flagged today (pickup: ${formatCollectionDays(collectionDays)}).`
        : `Today is a pickup day (${formatCollectionDays(collectionDays)}) — trash bins not flagged.`,
      results: withProps,
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
