"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [hoaName, setHoaName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseReady = isSupabaseClientConfigured();

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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not signed in");

      const trimmedName = fullName.trim();
      const trimmedHoa = hoaName.trim();
      if (!trimmedName || !trimmedHoa) {
        throw new Error("Please fill in both fields");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          hoa_name: trimmedHoa,
        },
      });
      if (updateError) throw updateError;

      // Optional: sync to profiles table when schema exists
      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: trimmedName,
        hoa_name: trimmedHoa,
      });

      router.push("/dashboard/onboarding");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile";
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
            Set up your profile
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            This name appears on violation notices and in your workspace settings.
          </p>

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
                className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
              />
            </div>
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save and continue
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
