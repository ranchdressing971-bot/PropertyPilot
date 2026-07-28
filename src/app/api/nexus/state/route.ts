import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { loadNexusState } from "@/lib/nexus/state";

export const dynamic = "force-dynamic";

/** Current Atlas state for the dashboard to poll after queueing work. */
export async function GET() {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const state = await loadNexusState();
  return NextResponse.json({ ok: true, ...state });
}
