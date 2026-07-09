"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { SystemCheckCard } from "@/components/settings/SystemCheckCard";
import clsx from "clsx";
import { CheckCircle2, XCircle, Loader2, LogOut } from "lucide-react";

interface HealthStatus {
  openai: boolean;
  supabase: boolean;
  openaiMessage: string;
  supabaseMessage: string;
}

function showDevTools(searchParams: URLSearchParams | null): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return searchParams?.get("dev") === "1";
}

export function SettingsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, setMode } = useAppMode();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const dev = showDevTools(searchParams);

  useEffect(() => {
    if (!dev) {
      setLoadingHealth(false);
      return;
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .finally(() => setLoadingHealth(false));
  }, [mode, dev]);

  async function signOut() {
    if (!isSupabaseClientConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setMode("demo");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {dev && (
        <>
          <Card>
            <h3 className="font-semibold text-ink-900">App Mode</h3>
            <p className="mt-1 text-sm text-ink-500">
              Demo uses sample data. Live runs real AI analysis. (Dev only)
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("demo")}
                className={clsx(
                  "rounded-xl border-2 p-4 text-left transition-all",
                  mode === "demo"
                    ? "border-ink-900 bg-ink-50 shadow-sm"
                    : "border-ink-200 hover:border-ink-300"
                )}
              >
                <p className="font-semibold text-ink-900">Demo</p>
                <p className="mt-1 text-xs text-ink-500">No API key needed</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("live")}
                className={clsx(
                  "rounded-xl border-2 p-4 text-left transition-all",
                  mode === "live"
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-ink-200 hover:border-ink-300"
                )}
              >
                <p className="font-semibold text-ink-900">Live</p>
                <p className="mt-1 text-xs text-ink-500">Real AI analysis</p>
              </button>
            </div>
            {mode === "live" && isSupabaseClientConfigured() && (
              <Link
                href="/login"
                className="mt-3 inline-block text-sm text-brand-600 hover:underline"
              >
                Sign in for live mode →
              </Link>
            )}
          </Card>

          <SystemCheckCard />

          <Card>
            <h3 className="font-semibold text-ink-900">Connection Status</h3>
            {loadingHealth ? (
              <Loader2 className="mt-4 h-5 w-5 animate-spin text-ink-400" />
            ) : health ? (
              <div className="mt-4 space-y-3">
                <StatusRow ok={health.openai} label="OpenAI" message={health.openaiMessage} />
                <StatusRow
                  ok={health.supabase}
                  label="Supabase"
                  message={health.supabaseMessage}
                />
              </div>
            ) : null}
          </Card>
        </>
      )}

      {isSupabaseClientConfigured() && (
        <Button variant="secondary" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      )}
    </div>
  );
}

function StatusRow({
  ok,
  label,
  message,
}: {
  ok: boolean;
  label: string;
  message: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-100">
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
      )}
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{message}</p>
      </div>
    </div>
  );
}
