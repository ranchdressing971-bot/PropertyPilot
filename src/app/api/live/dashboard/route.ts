import { NextResponse } from "next/server";
import { getLiveDashboardPayload } from "@/lib/live-data";

export async function GET() {
  return NextResponse.json(getLiveDashboardPayload());
}
