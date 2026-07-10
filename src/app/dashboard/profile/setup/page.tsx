"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { profileFromUser } from "@/lib/profile";
import { Loader2 } from "lucide-react";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [hoaName, setHoaName] = useState("");
  const [hoaLocked, setHoaLocked] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseReady = isSupabaseClientConfigured();

  useEffect(() => {
    if (!supabaseReady) {
      setLoadingUser(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) {
        setLoadingUser(false);
        return;
      }

      const fromMeta = profileFromUser(user);
      let hoa = fromMeta?.hoaName?.trim() ?? "";
      let name = fromMeta?.fullName?.trim() ?? "";

      // Prefer profiles table if metadata is empty
      const { data: row } = await supabase
        .from("profiles")
        .select("hoa_name, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (row?.hoa_name?.trim()) hoa = row.hoa_name.trim();
      if (row?.full_name?.trim()) name = row.full_name.trim();

      if (!cancelled) {
        setHoaName(hoa);
        setFullName(name);
        setHoaLocked(hoa.length > 0);
        setLoadingUser(false);

        // Already complete — don't make them fill the form again
        if (name && hoa) {
          router.replace("/dashboard/onboarding");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabaseReady, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setError("Sign-in is not configured. See docs/SUPABASE_SETUP.md");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not signed in");

      const trimmedName = fullName.trim();
      const trimmedHoa = hoaName.trim();
      if (!trimmedName) {
        throw new Error("Please enter your name");
      }
      if (!trimmedHoa) {
        throw new Error("Please enter your HOA / community name");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          hoa_name: trimmedHoa,
        },
      });
      if (updateError) throw updateError;

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: trimmedName,
        hoa_name: trimmedHoa,
      });

      const claimRes = await fetch("/api/community/claim-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoaName: trimmedHoa }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok && claimRes.status === 409) {
        setError(
          claimData.error ??
            "This community already used its free trial. You can still continue and subscribe."
        );
        await new Promise((r) => setTimeout(r, 1800));
      } else if (!claimRes.ok && claimData.code === "INVALID_COMMUNITY") {
        throw new Error(claimData.error ?? "Invalid community name");
      }

      router.push("/dashboard/onboarding");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save profile";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-5 py-12">
        <Card className="w-full" padding="lg">
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {hoaLocked ? "Almost done" : "Set up your profile"}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            {hoaLocked
              ? `You’ll inspect as ${hoaName}. Just add your name for notices.`
              : "Your community name locks the free trial to this HOA — one trial per community."}
          </p>

          {loadingUser ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-ink-700">
                  Your name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  autoFocus
                  className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                />
              </div>

              {hoaLocked ? (
                <div className="rounded-xl border border-ink-100 bg-ink-50/80 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                    Community
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900">
                    {hoaName}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-ink-700">
                    HOA / community name
                  </label>
                  <input
                    type="text"
                    required
                    value={hoaName}
                    onChange={(e) => setHoaName(e.target.value)}
                    placeholder="Oak Ridge Village HOA"
                    className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save and continue
              </Button>
            </form>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
