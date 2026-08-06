import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  fullName: string;
  hoaName: string;
  email: string;
}

const DEMO_PROFILE: UserProfile = {
  fullName: "Sarah Mitchell",
  hoaName: "Willow Creek Management",
  email: "manager@hoa.com",
};

export function profileFromUser(user: User | null): UserProfile | null {
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  return {
    fullName: (meta.full_name as string) ?? "",
    hoaName: (meta.hoa_name as string) ?? "",
    email: user.email ?? "",
  };
}

export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.fullName.trim().length > 0 && profile.hoaName.trim().length > 0;
}

export function getDemoProfile(): UserProfile {
  return { ...DEMO_PROFILE };
}

/** Display label for company / org (profiles.hoa_name stores company name). */
export function displayHoaName(profile: UserProfile | null, isDemo: boolean): string {
  if (isDemo) return "Willow Creek Estates";
  if (profile?.hoaName) return profile.hoaName.replace(/\s*HOA\s*$/i, "").trim();
  return "Your company";
}

export function displayManagerName(profile: UserProfile | null, isDemo: boolean): string {
  if (isDemo) return DEMO_PROFILE.fullName;
  return profile?.fullName?.trim() || "Community Manager";
}
