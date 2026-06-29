import { NextResponse } from "next/server";
import { listAIInspections } from "@/lib/inspection-store";
import { getViolation } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  for (const inspection of listAIInspections()) {
    const violation = inspection.violations.find((v) => v.id === id);
    if (violation) {
      return NextResponse.json({
        violation,
        aiPowered: true,
        inspectionId: inspection.id,
      });
    }
  }

  const violation = getViolation(id);
  if (violation) {
    return NextResponse.json({ violation, aiPowered: false });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
