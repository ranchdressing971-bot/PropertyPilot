import { NextResponse } from "next/server";
import { listAIInspections } from "@/lib/inspection-store";
import { isLiveModeFromCookie } from "@/lib/get-mode";
import { getLiveViolation } from "@/lib/live-data";
import { getViolation } from "@/lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const isLive = isLiveModeFromCookie(request.headers.get("cookie"));

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

  if (isLive) {
    const live = getLiveViolation(id);
    if (live) {
      return NextResponse.json({ violation: live, aiPowered: true });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const violation = getViolation(id);
  if (violation) {
    return NextResponse.json({ violation, aiPowered: false });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
