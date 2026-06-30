import type { User } from "@supabase/supabase-js";
import { isProfileComplete, profileFromUser } from "./profile";

/** Where to send a user immediately after sign-in or sign-up. */
export function postAuthPath(user: User, fallback = "/dashboard"): string {
  const profile = profileFromUser(user);
  if (!isProfileComplete(profile)) {
    return "/dashboard/profile/setup";
  }
  return fallback;
}
