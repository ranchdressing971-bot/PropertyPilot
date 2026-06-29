import { cookies } from "next/headers";
import type { AppMode } from "./app-mode";

export async function getServerAppMode(): Promise<AppMode> {
  const cookieStore = await cookies();
  const mode = cookieStore.get("pp-mode")?.value;
  return mode === "live" ? "live" : "demo";
}

export function isLiveModeFromCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes("pp-mode=live");
}
