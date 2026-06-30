import { listAIInspections } from "./inspection-store";
import type {
  ActivityItem,
  Inspection,
  Property,
  PropertyStatus,
  Violation,
} from "./mock-data";

export function getLiveInspections(): Inspection[] {
  return listAIInspections()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((ai) => ({
      id: ai.id,
      name: ai.name,
      date: ai.date,
      status: "completed" as const,
      videoName: ai.videoName,
      neighborhood: ai.neighborhood,
      propertiesScanned: ai.results.length,
      violationsFound: ai.violations.length,
      results: ai.results.map((r) => ({
        propertyId: r.propertyId,
        violation:
          ai.violations.find((v) => v.propertyId === r.propertyId) ?? null,
      })),
    }));
}

function propertyStatus(hasViolation: boolean): PropertyStatus {
  return hasViolation ? "Needs Review" : "Good Standing";
}

export function getLiveProperties(): Property[] {
  const byId = new Map<string, Property>();

  for (const insp of listAIInspections()) {
    for (const r of insp.results) {
      const viol = insp.violations.find((v) => v.propertyId === r.propertyId);
      byId.set(r.propertyId, {
        id: r.propertyId,
        address: r.address,
        image:
          viol?.evidenceImages[0] ??
          insp.propertyImages?.[r.propertyId] ??
          "",
        status: propertyStatus(Boolean(viol)),
        lastInspection: insp.date,
        neighborhood: insp.neighborhood,
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.address.localeCompare(b.address)
  );
}

export function getLiveViolations(): Violation[] {
  return listAIInspections().flatMap((i) => i.violations);
}

export function getLiveProperty(id: string): Property | undefined {
  return getLiveProperties().find((p) => p.id === id);
}

export function getLiveViolation(id: string): Violation | undefined {
  return getLiveViolations().find((v) => v.id === id);
}

export function getLivePropertyViolations(propertyId: string): Violation[] {
  return getLiveViolations().filter((v) => v.propertyId === propertyId);
}

export function getLiveDashboardStats() {
  const inspections = getLiveInspections();
  const violations = getLiveViolations();
  const neighborhoods = new Set(inspections.map((i) => i.neighborhood));

  return {
    neighborhoodsInspected: neighborhoods.size,
    videosProcessed: inspections.length,
    potentialViolations: violations.filter((v) => v.status === "pending").length,
    timeSavedHours: inspections.length * 4,
  };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function getLiveActivityFeed(): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const insp of getLiveInspections()) {
    items.push({
      id: `act-insp-${insp.id}`,
      type: "inspection",
      message: `Completed ${insp.name}`,
      time: formatRelativeTime(insp.date),
    });

    for (const v of getLiveViolations().filter((x) => x.inspectionId === insp.id)) {
      const prop = getLiveProperty(v.propertyId);
      items.push({
        id: `act-viol-${v.id}`,
        type: "violation",
        message: `${v.type} flagged at ${prop?.address ?? "property"}`,
        time: formatRelativeTime(v.detectedAt),
      });
    }
  }

  return items.slice(0, 8);
}

export function getLiveAIInsights() {
  const violations = getLiveViolations();
  const properties = getLiveProperties();
  const inspections = getLiveInspections();

  if (inspections.length === 0) {
    return null;
  }

  const counts = violations.reduce<Record<string, number>>((acc, v) => {
    if (!v.type) return acc;
    acc[v.type] = (acc[v.type] ?? 0) + 1;
    return acc;
  }, {});

  const mostCommon =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None yet";

  const goodStanding = properties.filter((p) => p.status === "Good Standing").length;
  const complianceScore =
    properties.length > 0
      ? Math.round((goodStanding / properties.length) * 100)
      : 100;

  const byAddress = violations.reduce<Record<string, number>>((acc, v) => {
    const addr = getLiveProperty(v.propertyId)?.address ?? v.propertyId;
    acc[addr] = (acc[addr] ?? 0) + 1;
    return acc;
  }, {});

  const repeatOffenders = Object.entries(byAddress)
    .filter(([, count]) => count > 1)
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    mostCommonViolation: mostCommon,
    avgInspectionTime: inspections.length > 0 ? "~20 min" : "—",
    complianceScore,
    repeatOffenders,
  };
}

export function getLiveDashboardPayload() {
  return {
    stats: getLiveDashboardStats(),
    activity: getLiveActivityFeed(),
    insights: getLiveAIInsights(),
    inspections: getLiveInspections(),
    properties: getLiveProperties(),
    violations: getLiveViolations(),
  };
}
