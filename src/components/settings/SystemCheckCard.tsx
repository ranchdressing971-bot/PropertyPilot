"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface SetupStatus {
  ok: boolean;
  env: {
    supabaseUrl: boolean;
    supabaseAnon: boolean;
    serviceRole: boolean;
    openai: boolean;
  };
  auth: { signedIn: boolean };
  database: {
    tableReadable: boolean;
    tableWritable: boolean;
    inspectionCount: number | null;
    error: string | null;
  };
  fixes: string[];
}

export function SystemCheckCard() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/setup-status", { credentials: "include" })
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <h3 className="font-display text-sm font-semibold text-ink-900">System check</h3>
      <p className="mt-1 text-sm text-ink-500">
        Verifies Supabase, sign-in, and that inspections can save.
      </p>

      {loading ? (
        <div className="mt-4 flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
        </div>
      ) : status ? (
        <div className="mt-4 space-y-3">
          <CheckRow ok={status.env.supabaseUrl} label="Supabase URL configured" />
          <CheckRow ok={status.env.supabaseAnon} label="Supabase anon key configured" />
          <CheckRow ok={status.env.serviceRole} label="Service role key (server saves)" />
          <CheckRow ok={status.env.openai} label="OpenAI key configured" />
          <CheckRow ok={status.auth.signedIn} label="You are signed in" />
          <CheckRow ok={status.database.tableReadable} label="Inspections table readable" />
          <CheckRow ok={status.database.tableWritable} label="You can write inspections" />

          {status.database.inspectionCount !== null && (
            <p className="text-xs text-ink-500">
              {status.database.inspectionCount} inspection
              {status.database.inspectionCount === 1 ? "" : "s"} saved in database.
            </p>
          )}

          {status.database.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {status.database.error}
            </p>
          )}

          {status.fixes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Fix these
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {status.fixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </div>
          )}

          {status.ok && (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              All checks passed — inspections should save and survive refresh.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      )}
      <span className={ok ? "text-ink-700" : "text-ink-900 font-medium"}>{label}</span>
    </div>
  );
}
