"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { NexusState } from "@/lib/nexus/state";
import clsx from "clsx";

const CITY_PRESETS = [
  { label: "Austin", query: "HOA management company in Austin TX" },
  { label: "Phoenix", query: "HOA management company in Phoenix AZ" },
  { label: "Charlotte", query: "community association management in Charlotte NC" },
  { label: "Dallas", query: "HOA management company in Dallas TX" },
];

export function NexusDashboard({ initialState }: { initialState: NexusState }) {
  const [state, setState] = useState(initialState);
  const [query, setQuery] = useState(CITY_PRESETS[0]!.query);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingNote, setWorkingNote] = useState<string | null>(null);

  const activeCompanies = useMemo(
    () => state.companies.filter((c) => c.status === "active"),
    [state.companies]
  );
  const approvedDrafts = useMemo(
    () => state.drafts.filter((d) => d.status === "approved"),
    [state.drafts]
  );
  const pendingDrafts = useMemo(
    () => state.drafts.filter((d) => d.status === "pending_approval"),
    [state.drafts]
  );
  const rejectedDrafts = useMemo(
    () => state.drafts.filter((d) => d.status === "rejected").slice(0, 5),
    [state.drafts]
  );

  const jobsOutstanding =
    state.queuedCount > 0 || state.jobs.some((j) => j.status === "running");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/nexus/state", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setState(data as NexusState);
    } catch {
      // Keep last good state.
    }
  }, []);

  useEffect(() => {
    if (!jobsOutstanding) return;
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
  }, [jobsOutstanding, refresh]);

  async function runWorkerUntilIdle(label: string, maxTicks = 12) {
    setWorkingNote(label);
    let totalProcessed = 0;
    try {
      for (let i = 0; i < maxTicks; i++) {
        const res = await fetch("/api/nexus/run", { method: "POST" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Worker failed");
        }
        totalProcessed += data.processed ?? 0;
        await refresh();
        if ((data.processed ?? 0) === 0) break;
        setWorkingNote(
          `${label} (${totalProcessed} steps done…)`
        );
      }
      return totalProcessed;
    } finally {
      setWorkingNote(null);
    }
  }

  async function startOutreach() {
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/nexus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, maxResults: 40 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Search failed");

      const processed = await runWorkerUntilIdle(
        "Running outreach pipeline: find → emails → draft → AI review…"
      );
      setMessage(
        processed
          ? "Pipeline finished for this batch. AI-approved emails are ready for sending once the mailbox is connected."
          : data.queued === false
            ? (data.message ?? "That search was already queued")
            : "Queued. Hit Continue pipeline if work is still pending."
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outreach failed");
    } finally {
      setBusy(false);
    }
  }

  async function continuePipeline() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      // Catch anything mid-chain: research pending companies, draft for
      // contacts without drafts, review pending drafts.
      if (state.phase2Ready) {
        await fetch("/api/nexus/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 12 }),
        });
        await fetch("/api/nexus/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 10 }),
        });
      }
      const processed = await runWorkerUntilIdle("Continuing pipeline…");
      setMessage(
        processed
          ? "Caught up. Check AI-approved emails below."
          : "Nothing left to process."
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Continue failed");
    } finally {
      setBusy(false);
    }
  }

  if (state.error) {
    return (
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">
              Nexus isn’t ready
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
              {state.error}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3">
        <p className="text-sm text-ink-600">
          <span className="font-medium text-ink-900">Nova</span> runs this
          pipeline. She’ll tell you what’s working and push back on weak sends.
        </p>
        <a
          href="/nova"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Open Nova →
        </a>
      </div>
      {!state.phase2Ready && (
        <Card className="border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-ink-900">
                One setup step left
              </h2>
              <p className="mt-1 text-sm text-ink-700">
                Run <code className="rounded bg-white px-1.5 py-0.5 text-xs">docs/NEXUS_SCHEMA_PHASE2.sql</code>{" "}
                in Supabase so email finding + drafting can run.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Automated outreach
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Pick a city. Nexus does the rest.
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-600">
          One click finds small local HOA managers, pulls public emails from
          their sites, writes drafts, and has AI approve or reject them. You
          don’t review every email; the AI does. Sending (1 email every 5–15 min,
          10am–3pm) plugs in once the mailbox exists.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {CITY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setQuery(preset.query)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                query === preset.query
                  ? "bg-ink-900 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            disabled={busy || !query.trim()}
            onClick={() => void startOutreach()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Start outreach
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void continuePipeline()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            Continue pipeline
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Leads", value: activeCompanies.length, icon: Building2 },
            { label: "Emails found", value: state.contactCount, icon: Mail },
            {
              label: "AI approved",
              value: approvedDrafts.length,
              icon: Check,
            },
            {
              label: "Waiting on AI",
              value: pendingDrafts.length,
              icon: Sparkles,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-ink-100 bg-ink-50/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 text-ink-500">
                <stat.icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">{stat.label}</span>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {(message || error || workingNote || jobsOutstanding) && (
        <p
          className={clsx(
            "text-sm font-medium",
            error ? "text-red-700" : "text-brand-800"
          )}
        >
          {error ??
            workingNote ??
            (jobsOutstanding
              ? `Working… ${state.queuedCount} jobs in queue`
              : message)}
        </p>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-900">
              Ready to send
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              AI-approved drafts. When the sender is connected, these go out at
              about one every 5–15 minutes from 10am–3pm, paced so it looks natural.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />
            Refresh
          </button>
        </div>

        {approvedDrafts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            None yet. Start outreach for a city above.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {approvedDrafts.map((draft) => (
              <li
                key={draft.id}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white">
                    AI approved
                  </span>
                  <p className="text-sm font-semibold text-ink-900">
                    {draft.company_name ?? "Company"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  To {draft.to_email}
                  {draft.confidence != null ? ` · score ${draft.confidence}` : ""}
                </p>
                <p className="mt-3 text-sm font-medium text-ink-800">
                  Subject: {draft.subject}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-700">
                  {draft.body}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingDrafts.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">
            AI still reviewing
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            {pendingDrafts.length} draft{pendingDrafts.length === 1 ? "" : "s"}{" "}
            waiting on the review hand. Hit Continue pipeline if this sits.
          </p>
        </Card>
      )}

      {rejectedDrafts.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">
            AI rejected (not sending)
          </h3>
          <ul className="mt-3 space-y-2">
            {rejectedDrafts.map((draft) => (
              <li key={draft.id} className="text-sm text-ink-700">
                <span className="font-medium">{draft.company_name ?? draft.to_email}</span>
                {draft.rejection_reason
                  ? `: ${draft.rejection_reason}`
                  : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink-900">
            Leads
          </h3>
          <span className="text-xs text-ink-500">
            {activeCompanies.length} active
          </span>
        </div>
        {activeCompanies.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-50">
            {activeCompanies.map((company) => (
              <li
                key={company.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {company.name}
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ml-1.5 inline-flex text-ink-400 hover:text-brand-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    {[company.city, company.state].filter(Boolean).join(", ") ||
                      "·"}
                    {typeof company.metadata?.userRatingCount === "number"
                      ? ` · ${company.metadata.userRatingCount} Google reviews`
                      : " · reviews unknown"}
                    {company.research_status
                      ? ` · ${company.research_status}`
                      : ""}
                  </p>
                </div>
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {state.contacts.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">
            Emails found
          </h3>
          <ul className="mt-3 divide-y divide-ink-50">
            {state.contacts.map((contact) => (
              <li key={contact.id} className="py-2.5">
                <p className="text-sm font-medium text-ink-900">{contact.email}</p>
                <p className="text-xs text-ink-500">
                  {contact.name ?? contact.role ?? "contact"} · confidence{" "}
                  {contact.confidence}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
