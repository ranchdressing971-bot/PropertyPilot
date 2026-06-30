import { NextResponse } from "next/server";
import { ensureStoreHydrated } from "@/lib/inspection-store";
import { getLiveDashboardPayload } from "@/lib/live-data";

export async function GET() {
  await ensureStoreHydrated();
  return NextResponse.json(getLiveDashboardPayload());
}
