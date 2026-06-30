"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { formatSupabaseAuthError } from "@/lib/supabase/config";
import { postAuthPath } from "@/lib/auth-redirect";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { Loader2 } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const { setMode } = useAppMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabaseReady = isSupabaseClientConfigured();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setError("Supabase is not configured yet. See docs/SUPABASE_SETUP.md");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile/setup`,
        },
      });

      if (authError) throw authError;

      setSuccess(true);
      setMode("live");

      if (authData.user && authData.session) {
        router.push(postAuthPath(authData.user, "/dashboard/profile/setup"));
      } else {
        router.push("/login?message=confirm-email");
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(formatSupabaseAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md" padding="lg">
      <h1 className="text-xl font-semibold text-slate-900">Create account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Start using Property Pilot in live mode
      </p>

      {!supabaseReady && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure Supabase first — see <code className="text-xs">docs/SUPABASE_SETUP.md</code>
        </div>
      )}

      {success ? (
        <p className="mt-4 text-sm text-emerald-700">
          Account created! Check your email if confirmation is required.
        </p>
      ) : (
        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !supabaseReady}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Account
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-600 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-accent-50/40 px-5 py-12">
      <div className="mb-8">
        <Logo size="md" href="/" />
      </div>
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-accent-600" />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
