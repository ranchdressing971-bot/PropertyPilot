import { NextRequest, NextResponse } from "next/server";
import { parseCsvRoster, normalizeRosterIds } from "@/lib/roster";
import type { Property } from "@/lib/mock-data";
import {
  getAuthenticatedUserId,
  persistProperties,
  logAudit,
} from "@/lib/supabase/persist";
import { setServerRoster } from "@/lib/roster-server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const csv = body.csv as string;
  const neighborhood = (body.neighborhood as string) || "Your Community";

  if (!csv?.trim()) {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }

  const parsed = normalizeRosterIds(parseCsvRoster(csv, neighborhood));
  const userId = await getAuthenticatedUserId();

  if (userId) {
    setServerRoster(userId, parsed);
    await persistProperties(userId, parsed);
    await logAudit(userId, "roster_import", "properties", "bulk", {
      count: parsed.length,
    });
  }

  return NextResponse.json({ properties: parsed, count: parsed.length });
}
