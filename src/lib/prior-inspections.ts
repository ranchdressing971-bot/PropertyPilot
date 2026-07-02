import { addressDedupeKey, addressesLikelySame } from "./address-normalize";
import type { Property } from "./mock-data";
import { loadInspectionsFromDb } from "./supabase/persist";

export interface PriorInspectionRecord {
  addressKey: string;
  address: string;
  inspectionId: string;
  inspectionDate: string;
  propertyId: string;
}

/** Addresses already inspected in this user's saved history. */
export async function loadPriorInspectedAddresses(
  userId: string,
  excludeInspectionId?: string
): Promise<Map<string, PriorInspectionRecord>> {
  const map = new Map<string, PriorInspectionRecord>();
  const inspections = await loadInspectionsFromDb(userId);

  for (const insp of inspections) {
    if (excludeInspectionId && insp.id === excludeInspectionId) continue;

    for (const result of insp.results) {
      const address = result.address?.trim();
      if (!address) continue;

      const key = addressDedupeKey(address);
      if (map.has(key)) continue;

      map.set(key, {
        addressKey: key,
        address,
        inspectionId: insp.id,
        inspectionDate: insp.date,
        propertyId: result.propertyId,
      });
    }
  }

  return map;
}

export function isPriorInspectedAddress(
  address: string,
  prior: Map<string, PriorInspectionRecord>
): PriorInspectionRecord | undefined {
  const key = addressDedupeKey(address);
  const direct = prior.get(key);
  if (direct) return direct;

  for (const record of prior.values()) {
    if (addressesLikelySame(record.address, address)) return record;
  }

  return undefined;
}

export function separatePriorInspected(
  properties: Property[],
  prior: Map<string, PriorInspectionRecord>
): { newProperties: Property[]; skipped: Property[] } {
  const newProperties: Property[] = [];
  const skipped: Property[] = [];

  for (const prop of properties) {
    const hit = isPriorInspectedAddress(prop.address, prior);
    if (hit) {
      skipped.push({
        ...prop,
        id: hit.propertyId,
        previouslyInspected: true,
        priorInspectionDate: hit.inspectionDate,
        priorInspectionId: hit.inspectionId,
      });
      continue;
    }
    newProperties.push(prop);
  }

  return { newProperties, skipped };
}
