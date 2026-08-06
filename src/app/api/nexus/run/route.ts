import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  NexusNotConfiguredError,
  NexusSchemaMissingError,
} from "@/lib/nexus/jobs";
import { runTick } from "@/lib/nexus/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Operator-triggered tick. Same worker as the GitHub Action, but callable from
 * the /nexus UI so Isaac doesn't have to wait up to 10 minutes for the
 * scheduler after queueing work.
 */
export async function POST() {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (
      err instanceof NexusNotConfiguredError ||
      err instanceof NexusSchemaMissingError
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed to run Nexus";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
