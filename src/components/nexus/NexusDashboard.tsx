"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  Clock,
  ExternalLink,
  Loader2,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { NexusState } from "@/lib/nexus/state";
import clsx from "clsx";

const SUGGESTED_QUERIES = [
  "HOA management company in Austin TX",
  "HOA management company in Phoenix AZ",
  "community association management in Charlotte NC",
];

const jobStatusStyles: Record<string, string> = {
  queued: "bg-amber-50 text-amber-800 ring-amber-600/10",
  running: "bg-brand-50 text-brand-700 ring-brand-600/10",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  failed: "bg-red-50 text-red-700 ring-red-600/10",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        jobStatusStyles[status] ?? "bg-ink-50 text-ink-600 ring-ink-600/10"
      )}
    >
      {status}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NexusDashboard({ initialState }: { initialState: NexusState }) {
  const [state, setState] = useState(initialState);
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(60);
  const [queueing, setQueueing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/nexus/state", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setState(data as NexusState);
    } catch {
      // Leave the last good state on screen rather than blanking the page.
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Poll while work is outstanding so results appear without a manual refresh.
  useEffect(() => {
    const busy =
      state.queuedCount > 0 || state.jobs.some((j) => j.status === "running");
    if (!busy) return;
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [state.queuedCount, state.jobs, refresh]);

  async function queueSearch(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed || queueing) return;

    setQueueing(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/nexus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, maxResults }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to queue search");
      } else if (data.queued === false) {
        setMessage(data.message ?? "Already queued");
      } else {
        setMessage("Queued — the next tick will run it");
        setQuery("");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue search");
    } finally {
      setQueueing(false);
    }
  }

  if (state.error) {
    return (
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">
              Nexus is not ready
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
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: "Companies", value: state.companyCount, icon: Building2 },
          { label: "Queued jobs", value: state.queuedCount, icon: Clock },
          { label: "New", value: state.stageCounts.new ?? 0, icon: Search },
          {
            label: "With website",
            value: state.companies.filter((c) => c.website).length,
            icon: ExternalLink,
          },
        ].map((stat) => (
          <motion.div key={stat.label} variants={staggerItem}>
            <Card padding="sm" className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">
                <stat.icon className="h-4 w-4 text-ink-600" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink-500">
                  {stat.label}
                </p>
                <p className="text-xl font-semibold tabular-nums text-ink-900">
                  {stat.value}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-900">
          Run Lead Hand
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Queues a Google Places search. Results are deduped by Place ID, so
          re-running the same query is safe.
        </p>

        <form
          className="mt-4 flex flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void queueSearch(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HOA management company in Austin TX"
            className="flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-400"
          >
            <option value={20}>Up to 20</option>
            <option value={60}>Up to 60</option>
            <option value={120}>Up to 120</option>
          </select>
          <button
            type="submit"
            disabled={queueing || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {queueing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Queue search
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTED_QUERIES.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
              className="rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-100"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {message && (
          <p className="mt-3 text-sm font-medium text-brand-700">{message}</p>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Companies
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </button>
        </div>

        {state.companies.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No companies yet. Queue a search above, then wait for the next
            scheduler tick.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="pb-2 pr-3 font-medium">Company</th>
                  <th className="pb-2 pr-3 font-medium">Location</th>
                  <th className="pb-2 pr-3 font-medium">Contact</th>
                  <th className="pb-2 pr-3 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Found</th>
                </tr>
              </thead>
              <tbody>
                {state.companies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-ink-50 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-ink-900">
                        {company.name}
                      </span>
                      {company.website && (
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="ml-1.5 inline-flex text-ink-400 transition-colors hover:text-brand-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {[company.city, company.state].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {company.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-ink-400" />
                          {company.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusPill status={company.stage} />
                    </td>
                    <td className="py-2.5 text-ink-500">
                      {relativeTime(company.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Job queue
          </h2>
          {state.jobs.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No jobs yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {state.jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-start justify-between gap-3 border-b border-ink-50 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {job.type}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {typeof job.payload?.query === "string"
                        ? job.payload.query
                        : "—"}
                      {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                    </p>
                    {job.last_error && (
                      <p className="mt-1 line-clamp-2 text-xs text-red-600">
                        {job.last_error}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={job.status} />
                    <p className="mt-1 text-[11px] text-ink-400">
                      {relativeTime(job.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Action log
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Every action Nexus takes, newest first.
          </p>
          {state.actions.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Nothing logged yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {state.actions.map((action) => (
                <li key={action.id} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={clsx(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      action.actor === "isaac" ? "bg-brand-600" : "bg-ink-300"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink-800">{action.action}</p>
                    <p className="text-xs text-ink-500">
                      {action.actor} · {relativeTime(action.created_at)}
                      {typeof action.metadata?.name === "string"
                        ? ` · ${action.metadata.name}`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
