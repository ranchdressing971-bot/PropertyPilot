"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { formatSupabaseAuthError } from "@/lib/supabase/config";
import { postAuthPath } from "@/lib/auth-redirect";
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      setMode("live");
      const destination = authData.user ? postAuthPath(authData.user, next) : next;
      router.push(destination);
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
    <AuthLayout>
      <Card className="w-full max-w-md" padding="lg">
        <h1 className="text-xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Live mode — real AI inspections with your account
        </p>

        {!supabaseReady && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Supabase isn&apos;t connected yet. Follow{" "}
            <code className="text-xs">docs/SUPABASE_SETUP.md</code> to enable sign-in,
            or use Demo mode below.
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-700">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@hoa.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Password</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !supabaseReady}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-ink-200" />
          <span className="text-xs text-ink-400">or</span>
          <div className="h-px flex-1 bg-ink-200" />
        </div>

        <Button variant="secondary" className="w-full" onClick={enterDemo}>
          Continue in demo mode
        </Button>

        <p className="mt-4 text-center text-sm text-ink-500">
          No account?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
