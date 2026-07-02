import { getOpenAIApiKey } from "@/lib/openai-env";

export type AppMode = "demo" | "live";

export const MODE_STORAGE_KEY = "property-pilot-mode";
export const MODE_COOKIE = "pp-mode";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isOpenAIConfigured(): boolean {
  return Boolean(getOpenAIApiKey());
}
