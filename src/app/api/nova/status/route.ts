import { NextResponse } from "next/server";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import {
  isNexusSendEnabled,
  isWithinOutreachWindow,
} from "@/lib/nexus/outreach-policy";
import { loadNexusState } from "@/lib/nexus/state";
import { loadBusinessBrief } from "@/lib/nova/business";
import { getNovaClock } from "@/lib/nova/clock";
import { loadConversionSummary } from "@/lib/nova/conversions";
import {
  isServerTtsConfigured,
  preferredNovaVoiceProvider,
} from "@/lib/nova/speak";
import { loadRecentNovaMessages } from "@/lib/nova/memory";
import { getNovaSendPlan } from "@/lib/nova/send-plan";
import { isResendConfigured } from "@/lib/resend";

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
  const plan = await getNovaSendPlan();
  const conversions = await loadConversionSummary(90);
  const business = await loadBusinessBrief();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXUS_APP_URL?.trim() ||
    null;
  const looksCustomDomain = Boolean(
    appUrl && !/vercel\.app/i.test(appUrl) && /^https?:\/\//i.test(appUrl)
  );

  const clock = getNovaClock();

  return NextResponse.json({
    clock: {
      timeZone: clock.timeZone,
      weekday: clock.weekday,
      date: clock.date,
      time: clock.timeWithZone,
      localISO: clock.isoLocal,
      utcISO: clock.isoUtc,
    },
    sendEnabled: isNexusSendEnabled(),
    novaArmed: plan.armed,
    dailyTarget: plan.dailyTarget,
    withinWindow: isWithinOutreachWindow(),
    plannedProvider: "resend",
    mailtrapVerified: false,
    resendConfigured: isResendConfigured(),
    customDomainLikely: looksCustomDomain,
    canTransmitLive: false,
    voiceConfigured: isServerTtsConfigured(),
    voiceProvider: preferredNovaVoiceProvider(),
    /** Desktop last resort when no server TTS audio is available. */
    browserVoiceFallback: true,
    queuedJobs: state.queuedCount,
    companies: state.companies.filter((c) => c.status === "active").length,
    approvedDrafts: state.drafts.filter((d) => d.status === "approved").length,
    sentDrafts: state.drafts.filter((d) => d.status === "sent").length,
    pendingDrafts: state.pendingDraftCount,
    conversionsMatched: conversions.matchedCount,
    conversionRate: conversions.conversionRate,
    subscribedCount: conversions.subscribedCount,
    subscriptionRate: conversions.subscriptionRate,
    sentInWindow: conversions.sentCount,
    recentSignupCount: conversions.recentSignupCount,
    business: {
      mrr: business.mrr,
      arr: business.arr,
      pipelineMrr: business.pipelineMrr,
      payingClients: business.payingClients,
      trialingClients: business.trialingClients,
      pastDueClients: business.pastDueClients,
      canceledClients: business.canceledClients,
      productCompanies: business.productCompanies,
      inspectionsTotal: business.inspectionsTotal,
      communityTrialsClaimed: business.communityTrialsClaimed,
      totalProfiles: business.totalProfiles,
      activation: business.activation,
      teams: business.teams,
      productUsage: {
        violationApproved: business.productUsage.violationApproved,
        violationDismissed: business.productUsage.violationDismissed,
        rosterImports: business.productUsage.rosterImports,
      },
      trials: {
        claimed: business.trials.claimed,
        converted: business.trials.claimedConverted,
        stillUnpaid: business.trials.claimedStillUnpaid,
      },
      trust: {
        abuseFlagged: business.trust.abuseFlagged,
        abuseHigh: business.trust.abuseHigh,
        abuseMedium: business.trust.abuseMedium,
        abuseLow: business.trust.abuseLow,
      },
      watchlistCounts: {
        pastDue: business.watchlists.pastDue.length,
        deadPaid: business.watchlists.deadPaid.length,
        trialBurned: business.watchlists.trialBurnedUnpaid.length,
        canceled: business.watchlists.canceled.length,
        underBilled: business.watchlists.underBilledCommunities.length,
      },
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
}
