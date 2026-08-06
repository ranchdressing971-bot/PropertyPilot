import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureCompanyForUser,
  getActiveCompanyContext,
} from "@/lib/company";

export async function GET() {
  const ctx = await getActiveCompanyContext();
  if (!ctx) {
    return NextResponse.json({ error: "No company workspace" }, { status: 404 });
  }

  return NextResponse.json({
    userId: ctx.userId,
    companyId: ctx.companyId,
    role: ctx.role,
    companyName: ctx.companyName,
    hoaName: ctx.hoaName,
  });
}

/** Create or refresh the signed-in user's company workspace from a company name. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const companyName = String(
    body.companyName ?? body.hoaName ?? ""
  ).trim();
  if (companyName.length < 2) {
    return NextResponse.json(
      { error: "Enter your company name.", code: "INVALID_COMPANY" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const client = admin ?? supabase;

  await client.from("profiles").upsert({
    id: user.id,
    email: user.email,
    hoa_name: companyName,
  });

  const ensured = await ensureCompanyForUser(user.id, companyName);
  if (!ensured) {
    return NextResponse.json(
      { error: "Could not create company workspace.", code: "COMPANY_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    companyId: ensured.companyId,
    companyName,
    created: ensured.created,
  });
}
