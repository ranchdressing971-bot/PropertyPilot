import { NextRequest, NextResponse } from "next/server";
import { acceptCompanyInvite } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = await acceptCompanyInvite({
    token,
    userId: user.id,
    userEmail: user.email,
  });

  if ("error" in result) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "EMAIL_MISMATCH"
          ? 403
          : 400;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, companyId: result.companyId });
}
