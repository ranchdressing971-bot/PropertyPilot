import { NextRequest, NextResponse } from "next/server";
import { parseCsvRoster, normalizeRosterIds } from "@/lib/roster";
import {
  getAuthenticatedUserId,
  persistProperties,
  logAudit,
} from "@/lib/supabase/persist";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const csv = body.csv as string;
  const neighborhood = (body.neighborhood as string) || "Your Community";

  if (!csv?.trim()) {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }

  const parsed = normalizeRosterIds(parseCsvRoster(csv, neighborhood));

  await persistProperties(userId, parsed);
  await logAudit(userId, "roster_import", "properties", "bulk", {
    count: parsed.length,
  });

  return NextResponse.json({ properties: parsed, count: parsed.length });
}
