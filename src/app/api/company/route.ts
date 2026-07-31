import { NextResponse } from "next/server";
import { getActiveCompanyContext } from "@/lib/company";

export async function GET() {
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }

  return NextResponse.json({
    userId: ctx.userId,
    companyId: ctx.companyId,
    role: ctx.role,
    companyName: ctx.companyName,
    hoaName: ctx.hoaName,
  });
}
