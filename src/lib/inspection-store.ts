import { AIInspectionData } from "./ai-analyze";
import type { ViolationStatus } from "./mock-data";
import {
  getAuthenticatedUserId,
  loadInspectionsFromDb,
  persistInspection,
  updateViolationInDb,
} from "./supabase/persist";

const store = new Map<string, AIInspectionData>();
let hydrated = false;

async function hydrateFromDb(): Promise<void> {
  if (hydrated) return;
  const userId = await getAuthenticatedUserId();
  if (userId) {
    const rows = await loadInspectionsFromDb(userId);
    for (const row of rows) {
      store.set(row.id, row);
    }
  }
  hydrated = true;
}

export function saveAIInspection(data: AIInspectionData): void {
  store.set(data.id, data);
  void (async () => {
    const userId = await getAuthenticatedUserId();
    if (userId) await persistInspection(userId, data);
  })();
}

export function getAIInspection(id: string): AIInspectionData | undefined {
  return store.get(id);
}

export function listAIInspections(): AIInspectionData[] {
  void hydrateFromDb();
  return Array.from(store.values());
}

export async function updateViolationStatus(
  violationId: string,
  status: ViolationStatus
): Promise<boolean> {
  for (const inspection of store.values()) {
    const idx = inspection.violations.findIndex((v) => v.id === violationId);
    if (idx === -1) continue;

    inspection.violations[idx] = {
      ...inspection.violations[idx],
      status,
    };
    store.set(inspection.id, inspection);

    const userId = await getAuthenticatedUserId();
    if (userId) {
      await updateViolationInDb(userId, inspection.id, violationId, status);
      await persistInspection(userId, inspection);
    }
    return true;
  }
  return false;
}
