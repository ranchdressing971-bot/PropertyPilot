import { NextResponse } from "next/server";
import { getAIInspection } from "@/lib/inspection-store";
import { isLiveModeFromCookie } from "@/lib/get-mode";
import { getLiveProperty } from "@/lib/live-data";
import { getInspection, getProperty, properties } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const isLive = isLiveModeFromCookie(request.headers.get("cookie"));

  const aiInspection = getAIInspection(id);
  if (aiInspection) {
    const resolveProperty = isLive ? getLiveProperty : getProperty;

    return NextResponse.json({
      ...aiInspection,
      results: aiInspection.results.map((r) => ({
        propertyId: r.propertyId,
        property:
          resolveProperty(r.propertyId) ?? {
            id: r.propertyId,
            address: r.address,
            image: "",
            status: aiInspection.violations.some((v) => v.propertyId === r.propertyId)
              ? "Needs Review"
              : "Good Standing",
            lastInspection: aiInspection.date,
            neighborhood: aiInspection.neighborhood,
          },
        violation:
          aiInspection.violations.find((v) => v.propertyId === r.propertyId) ??
          null,
        aiResult: r,
      })),
    });
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
