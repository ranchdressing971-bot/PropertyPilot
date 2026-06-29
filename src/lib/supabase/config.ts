/** Normalize and validate Supabase project URL from env. */
export function getSupabaseProjectUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;

  let url = raw.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");

  return url;
}

export function getSupabaseAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? null;
}

export function validateSupabaseProjectUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return "NEXT_PUBLIC_SUPABASE_URL must start with https://";
    }

    if (!parsed.hostname.endsWith(".supabase.co")) {
      return (
        "NEXT_PUBLIC_SUPABASE_URL must be your Supabase Project URL " +
        "(https://xxxx.supabase.co from Supabase → Settings → API). " +
        "Do not use your Vercel app URL here."
      );
    }

    if (parsed.pathname && parsed.pathname !== "/") {
      return (
        "Remove any path from NEXT_PUBLIC_SUPABASE_URL. " +
        "Use only https://your-project.supabase.co (no /rest/v1)."
      );
    }

    return null;
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.";
  }
}

export function formatSupabaseAuthError(message: string): string {
  if (
    message.includes("Invalid path") ||
    message.includes("PGRST125") ||
    message.includes("requested path is invalid")
  ) {
    return (
      "Supabase URL is misconfigured in Vercel. Set NEXT_PUBLIC_SUPABASE_URL to " +
      "Project URL from Supabase → Settings → API (https://xxxx.supabase.co). " +
      "Not your Vercel URL, and no /rest/v1 at the end. Redeploy after saving."
    );
  }

  return message;
}
