import { AIInspectionData } from "./ai-analyze";

const store = new Map<string, AIInspectionData>();

export function saveAIInspection(data: AIInspectionData): void {
  store.set(data.id, data);
}

export function getAIInspection(id: string): AIInspectionData | undefined {
  return store.get(id);
}

export function listAIInspections(): AIInspectionData[] {
  return Array.from(store.values());
}
