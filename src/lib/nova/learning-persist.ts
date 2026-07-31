import type { LearningReport } from "./conversions";
import { upsertNovaMemory } from "./memory";

/**
 * Persist a learning dossier into nova_memory so chat and background ticks share
 * the same lesson store.
 */
export async function persistNovaLearning(report: LearningReport): Promise<void> {
  const bits = [
    `${report.matchedCount}/${report.sentCount} signup converts (${report.conversionRate}%) last ${report.sinceDays}d`,
  ];
  if (report.subscribedCount > 0) {
    bits.push(
      `${report.subscribedCount} subscribed (${report.subscriptionRate}% of sends)`
    );
  }
  const topSubject = report.bySubject.find((s) => s.converted > 0);
  const topTheme = report.byTheme.find(
    (t) => t.converted > 0 && t.key !== "no_theme"
  );
  const topSubTheme = report.byThemeSubscribed.find(
    (t) => t.converted > 0 && t.key !== "no_theme"
  );
  const topCity = report.byCity.find((c) => c.converted > 0);
  if (topSubject) {
    bits.push(
      `subject: "${topSubject.key.slice(0, 70)}" (${topSubject.converted}/${topSubject.sent})`
    );
  }
  if (topTheme) {
    bits.push(
      `theme: ${topTheme.key} (${topTheme.converted}/${topTheme.sent}, ${topTheme.rate}%)`
    );
  }
  if (topSubTheme) {
    bits.push(
      `sub theme: ${topSubTheme.key} (${topSubTheme.converted}/${topSubTheme.sent})`
    );
  }
  if (topCity) {
    bits.push(`city: ${topCity.key} (${topCity.converted}/${topCity.sent})`);
  }
  if (report.avgDaysToSignup != null) {
    bits.push(`avg days→signup: ${report.avgDaysToSignup}`);
  }
  if (report.avgDaysToSubscribe != null) {
    bits.push(`avg days→subscribe: ${report.avgDaysToSubscribe}`);
  }
  if (report.insights[0]) bits.push(report.insights[0]);

  const now = new Date().toISOString();
  await upsertNovaMemory({
    kind: "trial",
    key: "outreach.learning",
    content: bits.join(" · "),
    metadata: {
      matchedCount: report.matchedCount,
      sentCount: report.sentCount,
      conversionRate: report.conversionRate,
      subscribedCount: report.subscribedCount,
      subscriptionRate: report.subscriptionRate,
      topThemesConverted: report.winnersVsLosers.topThemesConverted,
      topThemesSubscribed: report.byThemeSubscribed
        .filter((t) => t.converted > 0)
        .slice(0, 5)
        .map((t) => t.key),
      bestHoursEt: report.winnersVsLosers.bestHoursEt,
      avgDaysToSubscribe: report.avgDaysToSubscribe,
      insights: report.insights.slice(0, 6),
      at: now,
    },
  });

  const strategy = buildStrategyNote(report);
  if (strategy) {
    await upsertNovaMemory({
      kind: "trial",
      key: "outreach.strategy",
      content: strategy,
      metadata: {
        sentCount: report.sentCount,
        matchedCount: report.matchedCount,
        primaryInsight: report.insights[0] ?? null,
        at: now,
      },
    });
  }
}

function buildStrategyNote(report: LearningReport): string | null {
  if (report.sentCount === 0) {
    return "No sends yet — focus on approved draft quality and first small batch.";
  }

  const parts: string[] = [];
  const insight = report.insights[0];
  if (insight) parts.push(insight);

  const bestHour = report.winnersVsLosers.bestHoursEt[0];
  if (bestHour != null) {
    parts.push(`Favor ${bestHour}:00 ET sends when scheduling the next batch.`);
  }

  const topTheme = report.winnersVsLosers.topThemesConverted[0];
  if (topTheme) {
    parts.push(`Double down on "${topTheme}" angle in new drafts.`);
  } else if (report.matchedCount === 0) {
    parts.push(
      "No converts yet — keep volume modest, tighten copy, and re-check after 20+ more sends."
    );
  }

  return parts.length > 0 ? parts.join(" ") : null;
}
