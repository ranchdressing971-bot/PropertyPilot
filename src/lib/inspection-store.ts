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
let hydratedForUserId: string | null = null;

function rowToInspection(row: AIInspectionData): AIInspectionData {
  return row;
}

/** Always fetch fresh from Supabase (serverless-safe). */
export async function reloadStoreFromDb(): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    store.clear();
    hydratedForUserId = null;
    return;
  }

  store.clear();
  hydratedForUserId = userId;

  const rows = await loadInspectionsFromDb(userId);
  for (const row of rows) {
    store.set(row.id, rowToInspection(row));
  }
}

/** Load this user's inspections from Supabase (required on Vercel/serverless). */
export async function ensureStoreHydrated(): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;

  if (hydratedForUserId === userId) return;

  await reloadStoreFromDb();
}

export async function saveAIInspection(
  data: AIInspectionData
): Promise<{ ok: boolean; error?: string }> {
  const lean = stripInspectionForStorage(data);
  store.set(lean.id, lean);
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in — log in before running live inspections." };
  }

  const result = await persistInspection(userId, lean);
  if (result.ok) hydratedForUserId = userId;
  return result;
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
  await reloadStoreFromDb();
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
