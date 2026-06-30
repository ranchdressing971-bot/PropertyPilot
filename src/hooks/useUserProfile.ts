"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/profile";
import { getDemoProfile, profileFromUser } from "@/lib/profile";
import { useAppMode } from "@/components/providers/AppModeProvider";

export function useUserProfile() {
  const { isDemo } = useAppMode();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setProfile(getDemoProfile());
      setLoading(false);
      return;
    }

    if (!isSupabaseClientConfigured()) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setProfile(profileFromUser(user));
      setLoading(false);
    });
  }, [isDemo]);

  return { profile, loading, isDemo };
}
