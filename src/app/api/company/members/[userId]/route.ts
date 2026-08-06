import { NextRequest, NextResponse } from "next/server";
import {
  canManageTeam,
  getActiveCompanyContext,
  type CompanyRole,
} from "@/lib/company";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES: CompanyRole[] = ["owner", "admin", "inspector"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params;
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }
  if (!canManageTeam(ctx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const role = body.role as CompanyRole;
  if (!ROLES.includes(role) || role === "owner") {
    return NextResponse.json(
      { error: "Role must be admin or inspector" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data: target } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", ctx.companyId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }
  if (ctx.role === "admin" && target.role === "admin" && ctx.userId !== targetUserId) {
    return NextResponse.json({ error: "Only the owner can change admin roles" }, { status: 403 });
  }

  const { error } = await admin
    .from("company_members")
    .update({ role })
    .eq("company_id", ctx.companyId)
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetUserId, role });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params;
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }
  if (!canManageTeam(ctx.role)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (targetUserId === ctx.userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data: target } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", ctx.companyId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 400 });
  }

  const { error } = await admin
    .from("company_members")
    .delete()
    .eq("company_id", ctx.companyId)
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({ active_company_id: null })
    .eq("id", targetUserId)
    .eq("active_company_id", ctx.companyId);

  return NextResponse.json({ ok: true });
}
