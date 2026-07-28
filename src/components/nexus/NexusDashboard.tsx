"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  X,
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
  pending: "bg-ink-50 text-ink-600 ring-ink-600/10",
  pending_approval: "bg-amber-50 text-amber-800 ring-amber-600/10",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  rejected: "bg-red-50 text-red-700 ring-red-600/10",
  skipped: "bg-ink-50 text-ink-500 ring-ink-600/10",
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
  const [researching, setResearching] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
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

  async function queueResearch(limit = 10) {
    if (researching) return;
    setResearching(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/nexus/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to queue research");
      } else {
        setMessage(
          data.queued
            ? `Queued research for ${data.queued} compan${data.queued === 1 ? "y" : "ies"}`
            : (data.message ?? "Nothing left to research")
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue research");
    } finally {
      setResearching(false);
    }
  }

  async function queueDrafts(limit = 5) {
    if (drafting) return;
    setDrafting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/nexus/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to queue drafts");
      } else {
        setMessage(
          data.queued
            ? `Queued ${data.queued} draft${data.queued === 1 ? "" : "s"}`
            : (data.message ?? "No companies waiting for a draft")
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue drafts");
    } finally {
      setDrafting(false);
    }
  }

  async function reviewDraft(
    id: string,
    action: "approve" | "reject",
    opts?: { reason?: string; suppress?: boolean }
  ) {
    if (reviewingId) return;
    setReviewingId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/nexus/drafts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...opts }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to update draft");
      } else {
        setMessage(
          action === "approve"
            ? "Approved — nothing sends yet (sending hand not built)"
            : "Rejected"
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft");
    } finally {
      setReviewingId(null);
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

  const pendingResearch = state.companies.filter(
    (c) => c.website && (c.research_status === "pending" || !c.research_status)
  ).length;

  return (
    <div className="space-y-6">
      {!state.phase2Ready && (
        <Card className="border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-ink-900">
                Phase 2 schema not installed
              </h2>
              <p className="mt-1 text-sm text-ink-700">
                Run <code className="rounded bg-white px-1.5 py-0.5 text-xs">docs/NEXUS_SCHEMA_PHASE2.sql</code>{" "}
                in the Supabase SQL editor to unlock email research and drafting.
              </p>
            </div>
          </div>
        </Card>
      )}

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: "Companies", value: state.companyCount, icon: Building2 },
          { label: "Contacts", value: state.contactCount, icon: Mail },
          { label: "Drafts pending", value: state.pendingDraftCount, icon: Sparkles },
          { label: "Queued jobs", value: state.queuedCount, icon: Clock },
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
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Research Hand
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Crawls company websites for publicly posted emails. Honors robots.txt,
            keeps a small page budget, and records the source page for every address.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            {pendingResearch} compan{pendingResearch === 1 ? "y" : "ies"} waiting ·{" "}
            {state.researchedCount} researched
          </p>
          <button
            type="button"
            disabled={researching || !state.phase2Ready || pendingResearch === 0}
            onClick={() => void queueResearch(10)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
          >
            {researching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Research next 10
          </button>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Outreach Hand
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Writes personalized first-touch drafts for review. Does not send —
            approval only. Sending needs a separate domain and Gmail API later.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            {state.contactCount} contact{state.contactCount === 1 ? "" : "s"} ·{" "}
            {state.pendingDraftCount} pending approval
          </p>
          <button
            type="button"
            disabled={drafting || !state.phase2Ready || state.contactCount === 0}
            onClick={() => void queueDrafts(5)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
          >
            {drafting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Draft next 5
          </button>
        </Card>
      </div>

      {(message || error) && (
        <p
          className={clsx(
            "text-sm font-medium",
            error ? "text-red-700" : "text-brand-700"
          )}
        >
          {error ?? message}
        </p>
      )}

      {state.drafts.filter((d) => d.status === "pending_approval").length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Drafts pending approval
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Read each one. Approve clears it to send later; reject can suppress
            the address so it never gets drafted again.
          </p>
          <ul className="mt-4 space-y-4">
            {state.drafts
              .filter((d) => d.status === "pending_approval")
              .map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">
                        {draft.company_name ?? "Company"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        To {draft.to_email}
                        {draft.contact_name ? ` · ${draft.contact_name}` : ""}
                        {draft.confidence != null
                          ? ` · confidence ${draft.confidence}`
                          : ""}
                      </p>
                    </div>
                    <StatusPill status={draft.status} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink-800">
                    Subject: {draft.subject}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-700">
                    {draft.body}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={reviewingId === draft.id}
                      onClick={() => void reviewDraft(draft.id, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {reviewingId === draft.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === draft.id}
                      onClick={() =>
                        void reviewDraft(draft.id, "reject", {
                          reason: "Not a fit",
                          suppress: false,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-300 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === draft.id}
                      onClick={() =>
                        void reviewDraft(draft.id, "reject", {
                          reason: "Wrong or unwanted address",
                          suppress: true,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 disabled:opacity-50"
                    >
                      Reject + suppress
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      )}

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
                  <th className="pb-2 pr-3 font-medium">Phone</th>
                  <th className="pb-2 pr-3 font-medium">Research</th>
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
                      <StatusPill status={company.research_status || "pending"} />
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

      {state.contacts.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Contacts found
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="pb-2 pr-3 font-medium">Email</th>
                  <th className="pb-2 pr-3 font-medium">Name</th>
                  <th className="pb-2 pr-3 font-medium">Confidence</th>
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {state.contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-ink-50 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-ink-900">
                      {contact.email}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {contact.name ?? contact.role ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-600">
                      {contact.confidence}
                    </td>
                    <td className="py-2.5 text-ink-500">
                      {contact.source_url ? (
                        <a
                          href={contact.source_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                        >
                          page
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
                        : typeof job.payload?.companyId === "string"
                          ? `company ${job.payload.companyId.slice(0, 8)}…`
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
                        : typeof action.metadata?.email === "string"
                          ? ` · ${action.metadata.email}`
                          : typeof action.metadata?.to === "string"
                            ? ` · ${action.metadata.to}`
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
