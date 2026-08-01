"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");
  const [status, setStatus] = useState<"checking" | "need_auth" | "accepting" | "done" | "error">(
    "checking"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !isSupabaseClientConfigured()) {
      setStatus("error");
      setError("Invite link is invalid or auth is not configured.");
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setStatus("need_auth");
        return;
      }

      setStatus("accepting");
      const res = await fetch("/api/company/invites/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Could not accept invite");
        return;
      }
      setStatus("done");
      router.replace("/dashboard");
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const authRedirect = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <Card className="w-full max-w-md" padding="lg">
        <h1 className="font-display text-2xl font-semibold text-ink-900">
          Join company
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Accept this invite to access the shared HOA workspace.
        </p>

        <div className="mt-6">
          {status === "checking" || status === "accepting" ? (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "accepting" ? "Joining workspace…" : "Checking invite…"}
            </div>
          ) : null}

          {status === "need_auth" ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-600">
                Sign in with the invited email, then we’ll add you to the team.
              </p>
              <Link
                href={authRedirect}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink-900 text-sm font-medium text-white shadow-sm hover:bg-ink-800"
              >
                Sign in to accept
              </Link>
              <p className="text-center text-xs text-ink-400">
                No account yet?{" "}
                <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`} className="text-brand-700 underline">
                  Create one
                </Link>
              </p>
            </div>
          ) : null}

          {status === "error" ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}

          {status === "done" ? (
            <p className="text-sm text-ink-600">You’re in. Redirecting to the dashboard…</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
