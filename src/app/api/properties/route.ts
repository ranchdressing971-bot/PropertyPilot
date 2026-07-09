import { NextRequest, NextResponse } from "next/server";
import type { Property } from "@/lib/mock-data";
import {
  getAuthenticatedUserId,
  loadPropertiesFromDb,
  persistProperties,
} from "@/lib/supabase/persist";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const dbProps = await loadPropertiesFromDb(userId);
  return NextResponse.json({ properties: dbProps });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

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

  await persistProperties(userId, normalized);

  return NextResponse.json({ properties: normalized, count: normalized.length });
}
