"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { formatSupabaseAuthError } from "@/lib/supabase/config";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { Loader2 } from "lucide-react";

export default function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { setMode } = useAppMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseReady = isSupabaseClientConfigured();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setError("Supabase is not configured yet. See docs/SUPABASE_SETUP.md");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      setMode("live");
      router.push(next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(formatSupabaseAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    setMode("demo");
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-accent-50/40 px-5 py-12">
      <div className="mb-8">
        <Logo size="md" href="/" />
      </div>

      <Card className="w-full max-w-md" padding="lg">
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live mode — real AI inspections with your account
        </p>

        {!supabaseReady && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Supabase isn&apos;t connected yet. Follow{" "}
            <code className="text-xs">docs/SUPABASE_SETUP.md</code> to enable sign-in,
            or use Demo mode below.
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
              placeholder="manager@hoa.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-4 text-base focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !supabaseReady}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button variant="secondary" className="w-full" onClick={enterDemo}>
          Continue in Demo Mode
        </Button>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{" "}
          <Link href="/signup" className="font-medium text-accent-600 hover:underline">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
