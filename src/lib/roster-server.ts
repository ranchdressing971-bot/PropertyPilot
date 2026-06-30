import type { Property } from "./mock-data";
import { properties as demoProperties } from "./mock-data";

const serverRoster = new Map<string, Property[]>();

export function getServerRoster(userId: string | null): Property[] {
  if (userId) {
    const cached = serverRoster.get(userId);
    if (cached?.length) return cached;
  }
  return demoProperties;
}

export function setServerRoster(userId: string, properties: Property[]): void {
  serverRoster.set(userId, properties);
}

export function getCachedRoster(userId: string): Property[] | undefined {
  return serverRoster.get(userId);
}

export function setCachedRoster(userId: string, properties: Property[]): void {
  serverRoster.set(userId, properties);
}
