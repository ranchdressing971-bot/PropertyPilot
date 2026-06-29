import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseProjectUrl,
  validateSupabaseProjectUrl,
} from "./config";

export function createClient() {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error("Supabase is not configured. Add env vars to .env.local");
  }

  const urlError = validateSupabaseProjectUrl(url);
  if (urlError) {
    throw new Error(urlError);
  }

  return createBrowserClient(url, key);
}

export function isSupabaseClientConfigured(): boolean {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;
  return validateSupabaseProjectUrl(url) === null;
}
