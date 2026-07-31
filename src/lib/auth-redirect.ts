import type { User } from "@supabase/supabase-js";
import { isProfileComplete, profileFromUser } from "./profile";

/** Invite accept URLs should win over incomplete profile redirects. */
export function isInvitePath(path: string | null | undefined): boolean {
  return Boolean(path && path.startsWith("/invite/"));
}

/** Where to send a user immediately after sign-in or sign-up. */
export function postAuthPath(user: User, fallback = "/dashboard"): string {
  if (isInvitePath(fallback)) {
    return fallback;
  }
  const profile = profileFromUser(user);
  if (!isProfileComplete(profile)) {
    return "/dashboard/profile/setup";
  }
  return fallback;
}
