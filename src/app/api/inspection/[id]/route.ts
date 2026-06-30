import { NextResponse } from "next/server";
import { formatInspectionForDisplay } from "@/lib/inspection-display";
import { getAIInspection } from "@/lib/inspection-store";
import { isLiveModeFromCookie } from "@/lib/get-mode";
import { getInspection, getProperty, properties } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const isLive = isLiveModeFromCookie(request.headers.get("cookie"));

  const aiInspection = await getAIInspection(id);
  if (aiInspection) {
    return NextResponse.json(formatInspectionForDisplay(aiInspection));
  }

  if (isLive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inspection = getInspection(id);
  if (inspection) {
    const results = inspection.results.length
      ? inspection.results
      : properties.map((p) => ({ propertyId: p.id, violation: null }));

    return NextResponse.json({
      ...inspection,
      aiPowered: false,
      results: results.map((r) => ({
        ...r,
        property: getProperty(r.propertyId),
      })),
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
