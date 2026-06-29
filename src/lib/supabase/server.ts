import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseProjectUrl,
  validateSupabaseProjectUrl,
} from "./config";

export async function createClient() {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key || validateSupabaseProjectUrl(url)) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component — ignore
        }
      },
    },
  });
}
