import { NextRequest, NextResponse } from "next/server";
import type { Property } from "@/lib/mock-data";
import {
  getAuthenticatedUserId,
  loadPropertiesFromDb,
  persistProperties,
} from "@/lib/supabase/persist";
import { getCachedRoster, setCachedRoster } from "@/lib/roster-server";

export async function GET() {
  const userId = await getAuthenticatedUserId();

  if (userId) {
    const dbProps = await loadPropertiesFromDb(userId);
    if (dbProps.length > 0) {
      setCachedRoster(userId, dbProps);
      return NextResponse.json({ properties: dbProps });
    }
    const cached = getCachedRoster(userId);
    if (cached?.length) {
      return NextResponse.json({ properties: cached });
    }
  }

  return NextResponse.json({ properties: [] });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const body = await request.json();
  const incoming = (body.properties as Property[]) ?? [];

  if (incoming.length === 0) {
    return NextResponse.json({ error: "No properties provided" }, { status: 400 });
  }

  const normalized = incoming.map((p, i) => ({
    ...p,
    id: p.id || `prop-${i + 1}`,
    image: p.image ?? "",
    status: p.status ?? ("Good Standing" as const),
    lastInspection: p.lastInspection ?? "—",
  }));

  if (userId) {
    setCachedRoster(userId, normalized);
    await persistProperties(userId, normalized);
  }

  return NextResponse.json({ properties: normalized, count: normalized.length });
}
