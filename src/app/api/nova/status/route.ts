import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { isMailtrapConfigured, isMailtrapSandbox } from "@/lib/nexus/mailtrap";
import {
  isNexusSendEnabled,
  isWithinOutreachWindow,
} from "@/lib/nexus/outreach-policy";
import { loadNexusState } from "@/lib/nexus/state";
import { isElevenLabsConfigured } from "@/lib/nova/speak";
import { loadRecentNovaMessages } from "@/lib/nova/memory";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await checkNexusAdmin();
  if (!admin.allowed) {
    return NextResponse.json(
      { error: "Not authorized", reason: admin.reason },
      { status: 401 }
    );
  }

  const state = await loadNexusState(30);
  const messages = await loadRecentNovaMessages(20);

  return NextResponse.json({
    sendEnabled: isNexusSendEnabled(),
    withinWindow: isWithinOutreachWindow(),
    mailtrapConfigured: isMailtrapConfigured(),
    mailtrapSandbox: isMailtrapSandbox(),
    voiceConfigured: isElevenLabsConfigured(),
    queuedJobs: state.queuedCount,
    companies: state.companies.filter((c) => c.status === "active").length,
    approvedDrafts: state.drafts.filter((d) => d.status === "approved").length,
    sentDrafts: state.drafts.filter((d) => d.status === "sent").length,
    pendingDrafts: state.pendingDraftCount,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
}
