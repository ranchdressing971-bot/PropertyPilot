"use client";

import { useEffect, useState } from "react";

export interface LiveDashboardPayload {
  stats: {
    neighborhoodsInspected: number;
    videosProcessed: number;
    potentialViolations: number;
    timeSavedHours: number;
  };
  activity: import("@/lib/mock-data").ActivityItem[];
  insights: {
    mostCommonViolation: string;
    avgInspectionTime: string;
    complianceScore: number;
    repeatOffenders: { address: string; count: number }[];
  } | null;
  inspections: import("@/lib/mock-data").Inspection[];
  properties: import("@/lib/mock-data").Property[];
  violations: import("@/lib/mock-data").Violation[];
}

export function useLiveDashboard(enabled = true) {
  const [data, setData] = useState<LiveDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);

  function refresh() {
    if (!enabled) return Promise.resolve();
    setLoading(true);
    return fetch("/api/live/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [enabled]);

  return { data, loading, refresh };
}
