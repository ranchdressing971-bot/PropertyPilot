"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function SettingsPanel() {
  const router = useRouter();
  const { mode, setMode } = useAppMode();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .finally(() => setLoadingHealth(false));
  }, [mode]);

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
      <Card>
        <h3 className="font-semibold text-slate-900">App Mode</h3>
        <p className="mt-1 text-sm text-slate-500">
          Demo uses sample data. Live runs real GPT-4o analysis.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={clsx(
              "rounded-xl border-2 p-4 text-left transition-all",
              mode === "demo"
                ? "border-violet-500 bg-violet-50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <p className="font-semibold text-slate-900">Demo</p>
            <p className="mt-1 text-xs text-slate-500">No API key needed</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={clsx(
              "rounded-xl border-2 p-4 text-left transition-all",
              mode === "live"
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <p className="font-semibold text-slate-900">Live</p>
            <p className="mt-1 text-xs text-slate-500">Real AI analysis</p>
          </button>
        </div>
        {mode === "live" && !isSupabaseClientConfigured() && (
          <p className="mt-3 text-xs text-slate-500">
            Live mode works without sign-in until Supabase is configured.
          </p>
        )}
        {mode === "live" && isSupabaseClientConfigured() && (
          <Link href="/login" className="mt-3 inline-block text-sm text-accent-600 hover:underline">
            Sign in for live mode →
          </Link>
        )}
      </Card>

      <SystemCheckCard />

      <Card>
        {loadingHealth ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-slate-400" />
        ) : health ? (
          <div className="mt-4 space-y-3">
            <StatusRow ok={health.openai} label="OpenAI" message={health.openaiMessage} />
            <StatusRow ok={health.supabase} label="Supabase" message={health.supabaseMessage} />
          </div>
        ) : null}
      </Card>

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
    <div className="flex gap-3 rounded-xl bg-slate-50 p-4">
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
      )}
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{message}</p>
      </div>
    </div>
  );
}
