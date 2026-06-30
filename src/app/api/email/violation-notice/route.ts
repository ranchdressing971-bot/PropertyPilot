import { NextRequest, NextResponse } from "next/server";
import { getResend, getEmailFrom, isResendConfigured } from "@/lib/resend";
import { getAuthenticatedUserId } from "@/lib/supabase/persist";
import { createClient } from "@/lib/supabase/server";

interface EmailBody {
  to: string;
  subject?: string;
  propertyAddress: string;
  violationType: string;
  violationDescription: string;
  hoaName?: string;
  managerName?: string;
}

export async function POST(req: NextRequest) {
  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: "Email not configured. Add RESEND_API_KEY to environment." },
      { status: 503 }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json()) as EmailBody;
  if (!body.to || !body.propertyAddress || !body.violationType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  let hoaName = body.hoaName ?? "Your HOA";
  let managerName = body.managerName ?? "Property Manager";

  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("hoa_name, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.hoa_name) hoaName = profile.hoa_name;
    if (profile?.full_name) managerName = profile.full_name;
  }

  const subject =
    body.subject ?? `HOA Violation Notice — ${body.propertyAddress}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; color: #1a1a20;">
      <p style="font-size: 12px; color: #676774; text-transform: uppercase; letter-spacing: 0.1em;">${hoaName}</p>
      <h1 style="font-size: 20px; margin: 8px 0;">Violation Notice</h1>
      <p><strong>Property:</strong> ${body.propertyAddress}</p>
      <p><strong>Issue:</strong> ${body.violationType}</p>
      <p style="line-height: 1.6;">${body.violationDescription}</p>
      <p style="margin-top: 24px; font-size: 13px; color: #676774;">
        — ${managerName}<br/>
        Sent via Property Pilot. Human review is required before enforcement.
      </p>
    </div>
  `;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: body.to,
    subject,
    html,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id, sent: true });
}
