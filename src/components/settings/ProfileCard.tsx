"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { getDemoProfile, profileFromUser } from "@/lib/profile";
import { Building2, User, Loader2, Pencil } from "lucide-react";

export function ProfileCard() {
  const { isDemo } = useAppMode();
  const [fullName, setFullName] = useState("");
  const [hoaName, setHoaName] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      const demo = getDemoProfile();
      setFullName(demo.fullName);
      setHoaName(demo.hoaName);
      setLoading(false);
      return;
    }

    if (!isSupabaseClientConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const profile = profileFromUser(user);
      setFullName(profile?.fullName ?? "");
      setHoaName(profile?.hoaName ?? "");
      setLoading(false);
    });
  }, [isDemo]);

  async function handleSave() {
    if (isDemo) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not signed in");

      const trimmedName = fullName.trim();
      const trimmedHoa = hoaName.trim();
      if (!trimmedName || !trimmedHoa) {
        throw new Error("Both fields are required");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName, hoa_name: trimmedHoa },
      });
      if (updateError) throw updateError;

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: trimmedName,
        hoa_name: trimmedHoa,
      });

      // Best-effort trial claim / rename — never block saving your profile
      const claimRes = await fetch("/api/community/claim-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoaName: trimmedHoa }),
      });
      if (!claimRes.ok) {
        const claimData = await claimRes.json().catch(() => ({}));
        // Profile is saved; show a soft warning only
        setError(
          claimData.error ??
            "Profile saved, but the free-trial community could not be updated."
        );
      }

      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-ink-400" />
          <div className="flex-1">
            <h3 className="font-semibold text-ink-900">Organization</h3>
            {editing && !isDemo ? (
              <input
                value={hoaName}
                onChange={(e) => setHoaName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
              />
            ) : (
              <p className="text-sm text-ink-500">
                {hoaName || "Not set — complete your profile"}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-ink-400" />
          <div className="flex-1">
            <h3 className="font-semibold text-ink-900">Manager Profile</h3>
            {editing && !isDemo ? (
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
              />
            ) : (
              <p className="text-sm text-ink-500">
                {fullName || "Not set — complete your profile"}
              </p>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {isDemo ? (
          <p className="mt-4 text-xs text-ink-400">
            Demo mode uses sample names. Sign in to use your own profile.
          </p>
        ) : editing ? (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Profile
          </Button>
        )}
      </Card>
    </div>
  );
}
