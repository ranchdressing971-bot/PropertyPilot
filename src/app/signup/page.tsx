"use client";

import { Suspense, useEffect, useState } from "react";
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
import { Loader2, Sparkles } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setMode } = useAppMode();

  const [fromFreeOffer, setFromFreeOffer] = useState(
    searchParams.get("offer") === "free-run"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hoaName, setHoaName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabaseReady = isSupabaseClientConfigured();

  useEffect(() => {
    if (searchParams.get("offer") === "free-run") {
      setFromFreeOffer(true);
      try {
        localStorage.setItem("pp-offer", "free-run");
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      if (localStorage.getItem("pp-offer") === "free-run") {
        setFromFreeOffer(true);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }
    if (!hoaName.trim()) {
      setError("Enter your HOA / community name.");
      return;
    }
    if (!supabaseReady) {
      setError("Supabase is not configured yet. See docs/SUPABASE_SETUP.md");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const trimmedHoa = hoaName.trim();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile/setup`,
          data: {
            terms_accepted_at: new Date().toISOString(),
            hoa_name: trimmedHoa,
            ...(fromFreeOffer ? { offer: "free-run" } : {}),
          },
        },
      });

      if (authError) throw authError;

      // Ensure metadata is set even if signUp options were ignored
      if (authData.session) {
        await supabase.auth.updateUser({
          data: { hoa_name: trimmedHoa },
        });
      }

      if (authData.user) {
        await supabase.from("profiles").upsert({
          id: authData.user.id,
          email: authData.user.email,
          hoa_name: trimmedHoa,
          terms_accepted_at: new Date().toISOString(),
        });
      }

      if (authData.session) {
        const claimRes = await fetch("/api/community/claim-trial", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hoaName: trimmedHoa }),
        });
        if (claimRes.status === 409) {
          const data = await claimRes.json();
          setError(
            data.error ??
              "This community already used its free trial. You can still create an account and subscribe."
          );
        }
      }

      try {
        localStorage.removeItem("pp-offer");
      } catch {
        /* ignore */
      }

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
      {fromFreeOffer && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-200">
          <Sparkles className="h-3.5 w-3.5" />
          Manager invite · free inspection unlocks after signup
        </p>
      )}
      <h1 className="font-display text-xl font-semibold text-ink-900">
        {fromFreeOffer ? "Claim your free run" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {fromFreeOffer
          ? "Create your account, then upload one drive-through of your community — on us."
          : "1 free inspection per community · from $99/mo"}
      </p>

      {!supabaseReady && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure Supabase first — see{" "}
          <code className="text-xs">docs/SUPABASE_SETUP.md</code>
        </div>
      )}

      {success ? (
        <p className="mt-4 text-sm text-emerald-700">
          Account created! Check your email if confirmation is required.
        </p>
      ) : (
        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-700">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Password</label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">
              HOA / community name
            </label>
            <Input
              type="text"
              required
              value={hoaName}
              onChange={(e) => setHoaName(e.target.value)}
              placeholder="Oak Ridge Village HOA"
            />
            <p className="mt-1 text-xs text-ink-400">
              One free trial per community — use your real HOA name.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-ink-300"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-medium text-copper-700 hover:underline"
                target="_blank"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-copper-700 hover:underline"
                target="_blank"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !supabaseReady || !agreed}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {fromFreeOffer ? "Unlock free inspection" : "Create account"}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-copper-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={<Loader2 className="h-8 w-8 animate-spin text-copper-600" />}
      >
        <SignupForm />
      </Suspense>
    </AuthLayout>
  );
}
