import { NextResponse } from "next/server";
import { getAIInspection } from "@/lib/inspection-store";
import { getInspection, getProperty, properties } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const aiInspection = getAIInspection(id);
  if (aiInspection) {
    return NextResponse.json({
      ...aiInspection,
      results: aiInspection.results.map((r) => ({
        propertyId: r.propertyId,
        property: getProperty(r.propertyId),
        violation: aiInspection.violations.find(
          (v) => v.propertyId === r.propertyId
        ) ?? null,
        aiResult: r,
      })),
    });
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
