import { createClient } from "@/lib/supabase/server";

/**
 * Nexus is internal tooling, so access is gated to an explicit operator list
 * rather than a role system. Set NEXUS_ADMIN_EMAIL to one email, or several
 * separated by commas.
 */

export interface NexusAdminCheck {
  allowed: boolean;
  /** Why access was denied, for showing a useful message instead of a 404 */
  reason?: "not_configured" | "not_signed_in" | "not_admin";
  email?: string;
}

export async function checkNexusAdmin(): Promise<NexusAdminCheck> {
  const configured = (process.env.NEXUS_ADMIN_EMAIL ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length === 0) return { allowed: false, reason: "not_configured" };

  const supabase = await createClient();
  if (!supabase) return { allowed: false, reason: "not_signed_in" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  if (!email) return { allowed: false, reason: "not_signed_in" };
  if (!configured.includes(email)) return { allowed: false, reason: "not_admin", email };

  return { allowed: true, email };
}

export async function isNexusAdmin(): Promise<boolean> {
  return (await checkNexusAdmin()).allowed;
}
