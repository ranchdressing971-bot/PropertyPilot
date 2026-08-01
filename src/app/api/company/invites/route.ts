import { NextRequest, NextResponse } from "next/server";
import {
  canManageTeam,
  createCompanyInvite,
  getActiveCompanyContext,
} from "@/lib/company";

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }
  if (!canManageTeam(ctx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "inspector";

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const result = await createCompanyInvite({
    companyId: ctx.companyId,
    email,
    role,
    invitedBy: ctx.userId,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://rideby-ai.vercel.app";
  const inviteUrl = `${origin.replace(/\/$/, "")}/invite/${result.token}`;

  return NextResponse.json({
    ok: true,
    id: result.id,
    token: result.token,
    inviteUrl,
    email,
    role,
  });
}
