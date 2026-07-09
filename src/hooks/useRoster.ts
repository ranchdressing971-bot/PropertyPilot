"use client";

import { useCallback, useEffect, useState } from "react";
import type { Property } from "@/lib/mock-data";
import {
  rosterFromStorage,
  saveRosterToStorage,
  normalizeRosterIds,
} from "@/lib/roster";

export function useRoster() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      const list =
        data.properties?.length > 0 ? data.properties : rosterFromStorage();
      setProperties(list);
      if (data.properties?.length > 0) {
        saveRosterToStorage(data.properties);
      }
    } catch {
      setProperties(rosterFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveRoster(list: Property[]) {
    const normalized = normalizeRosterIds(list);
    saveRosterToStorage(normalized);
    setProperties(normalized);
    await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: normalized }),
    });
  }

  async function importCsv(csv: string, neighborhood: string) {
    const res = await fetch("/api/properties/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, neighborhood }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Import failed");
    const normalized = normalizeRosterIds(data.properties);
    saveRosterToStorage(normalized);
    setProperties(normalized);
    return { properties: normalized, count: data.count ?? normalized.length };
  }

  return { properties, loading, refresh, saveRoster, importCsv };
}
