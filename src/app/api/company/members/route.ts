import { NextResponse } from "next/server";
import { canManageTeam, getActiveCompanyContext } from "@/lib/company";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data: members, error } = await admin
    .from("company_members")
    .select("id, user_id, role, status, created_at")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", m.user_id)
        .maybeSingle();
      return {
        ...m,
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
      };
    })
  );

  const invites =
    canManageTeam(ctx.role)
      ? (
          await admin
            .from("company_invites")
            .select("id, email, role, expires_at, accepted_at, created_at, token")
            .eq("company_id", ctx.companyId)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

  return NextResponse.json({
    role: ctx.role,
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    members: enriched,
    invites,
  });
}
