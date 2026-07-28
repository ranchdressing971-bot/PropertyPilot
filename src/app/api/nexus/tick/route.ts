import { NextResponse } from "next/server";
import { runTick } from "@/lib/nexus/runner";
import {
  NexusNotConfiguredError,
  NexusSchemaMissingError,
} from "@/lib/nexus/jobs";

/**
 * Nexus job runner endpoint.
 *
 * Called on a schedule by an external scheduler (see .github/workflows/nexus-tick.yml)
 * rather than Vercel Cron, because Hobby plans allow only one cron per day with
 * up to 59 minutes of drift. The Hobby limit applies to Vercel's scheduler, not
 * to the endpoint, so any HTTP scheduler can drive this at any frequency.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.NEXUS_CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Constant-length comparison isn't meaningful here without equal lengths,
  // so compare after a cheap length check.
  return provided.length === secret.length && provided === secret;
}

async function handle(request: Request) {
  if (!process.env.NEXUS_CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "NEXUS_CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
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
    const message = err instanceof Error ? err.message : "Tick failed";
    console.error("[nexus] tick failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
