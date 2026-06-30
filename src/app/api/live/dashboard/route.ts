import { NextResponse } from "next/server";
import { reloadStoreFromDb } from "@/lib/inspection-store";
import { getLiveDashboardPayload } from "@/lib/live-data";

export async function GET() {
  await reloadStoreFromDb();
  return NextResponse.json(getLiveDashboardPayload());
}
