import { NextResponse } from "next/server";
import {
  logAbuseScanSummary,
  scanCommunityUsageAbuse,
} from "@/lib/abuse/community-usage-scan";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cronAuthorized(request: Request): boolean {
  const secret = process.env.NEXUS_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  return provided.length === secret.length && provided === secret;
}

/**
 * Community abuse bot — under-billed multi-community detection.
 * Auth: Nexus admin session OR NEXUS_CRON_SECRET bearer.
 * Never blocks product use; returns suspects for review.
 */
export async function GET(request: Request) {
  return run(request, false);
}

export async function POST(request: Request) {
  let persist = false;
  const url = new URL(request.url);
  if (url.searchParams.get("persist") === "1") persist = true;
  try {
    const body = (await request.json()) as { persist?: boolean };
    if (body?.persist) persist = true;
  } catch {
    /* no JSON body */
  }
  return run(request, persist);
}

async function run(request: Request, persist: boolean) {
  const admin = await checkNexusAdmin();
  const cronOk = cronAuthorized(request);
  if (!admin.allowed && !cronOk) {
    return NextResponse.json(
      { error: "Not authorized", reason: admin.reason },
      { status: 401 }
    );
  }

  const report = await scanCommunityUsageAbuse({ limit: 40 });
  if (persist) {
    await logAbuseScanSummary(report);
  }

  return NextResponse.json({
    ok: true,
    persisted: persist,
    ...report,
  });
}
