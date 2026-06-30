import type { AIInspectionData } from "./ai-analyze";
import { stripInspectionForStorage } from "./inspection-sanitize";
import type { ViolationStatus } from "./mock-data";
import {
  getAuthenticatedUserId,
  loadInspectionFromDbById,
  loadInspectionsFromDb,
  persistInspection,
  updateViolationInDb,
} from "./supabase/persist";

const store = new Map<string, AIInspectionData>();
let hydrated = false;

function rowToInspection(row: AIInspectionData): AIInspectionData {
  return row;
}

/** Load this user's inspections from Supabase (required on Render/serverless). */
export async function ensureStoreHydrated(): Promise<void> {
  if (hydrated) return;
  const userId = await getAuthenticatedUserId();
  if (userId) {
    const rows = await loadInspectionsFromDb(userId);
    for (const row of rows) {
      store.set(row.id, rowToInspection(row));
    }
  }
  hydrated = true;
}

export async function saveAIInspection(data: AIInspectionData): Promise<boolean> {
  const lean = stripInspectionForStorage(data);
  store.set(lean.id, lean);
  const userId = await getAuthenticatedUserId();
  if (userId) {
    return persistInspection(userId, lean);
  }
  return false;
}

export async function getAIInspection(id: string): Promise<AIInspectionData | undefined> {
  const cached = store.get(id);
  if (cached) return cached;

  await ensureStoreHydrated();
  const afterHydrate = store.get(id);
  if (afterHydrate) return afterHydrate;

  const userId = await getAuthenticatedUserId();
  if (!userId) return undefined;

  const fromDb = await loadInspectionFromDbById(userId, id);
  if (fromDb) {
    store.set(id, fromDb);
    return fromDb;
  }

  return undefined;
}

/** @deprecated Prefer listAIInspectionsAsync in API routes */
export function listAIInspections(): AIInspectionData[] {
  return Array.from(store.values());
}

export async function listAIInspectionsAsync(): Promise<AIInspectionData[]> {
  await ensureStoreHydrated();
  return Array.from(store.values());
}

export async function updateViolationStatus(
  violationId: string,
  status: ViolationStatus
): Promise<boolean> {
  await ensureStoreHydrated();

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
