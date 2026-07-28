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
  Search,
  Sparkles,
  X,
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

type StepId = "find" | "emails" | "write" | "review";

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
  const [query, setQuery] = useState(CITY_PRESETS[0]!.query);
  const [busy, setBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingNote, setWorkingNote] = useState<string | null>(null);

  const activeCompanies = useMemo(
    () => state.companies.filter((c) => c.status === "active"),
    [state.companies]
  );
  const pendingResearch = useMemo(
    () =>
      activeCompanies.filter(
        (c) =>
          c.website &&
          (c.research_status === "pending" || !c.research_status)
      ).length,
    [activeCompanies]
  );
  const pendingDrafts = useMemo(
    () => state.drafts.filter((d) => d.status === "pending_approval"),
    [state.drafts]
  );
  const needsDraft = useMemo(() => {
    const drafted = new Set(
      state.drafts
        .filter((d) =>
          ["pending_approval", "approved", "sent"].includes(d.status)
        )
        .map((d) => d.company_id)
    );
    const withContact = new Set(state.contacts.map((c) => c.company_id));
    let n = 0;
    for (const id of withContact) if (!drafted.has(id)) n += 1;
    return n;
  }, [state.contacts, state.drafts]);

  const jobsOutstanding =
    state.queuedCount > 0 || state.jobs.some((j) => j.status === "running");

  const nextStep: StepId = useMemo(() => {
    if (pendingDrafts.length > 0) return "review";
    if (needsDraft > 0) return "write";
    if (pendingResearch > 0 || (activeCompanies.length > 0 && state.contactCount === 0)) {
      return "emails";
    }
    if (activeCompanies.length === 0) return "find";
    return "find";
  }, [
    pendingDrafts.length,
    needsDraft,
    pendingResearch,
    activeCompanies.length,
    state.contactCount,
  ]);

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

  async function runWorker(label = "Working…") {
    setWorkingNote(label);
    try {
      const res = await fetch("/api/nexus/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Worker failed");
      }
      await refresh();
      return data as { processed: number; succeeded: number; failed: number };
    } finally {
      setWorkingNote(null);
    }
  }

  async function findCompanies() {
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
      if (data.queued === false) {
        setMessage(data.message ?? "That search is already running");
      } else {
        const result = await runWorker("Searching Google for companies…");
        setMessage(
          result.processed
            ? `Done — found new companies (big ones filtered out).`
            : "Search queued. Hit Run again in a moment if nothing appears."
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function findEmails() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/nexus/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 12 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Research failed");
      if (!data.queued) {
        setMessage(data.message ?? "No companies left to research");
      } else {
        const result = await runWorker(
          `Visiting ${data.queued} website${data.queued === 1 ? "" : "s"} for emails…`
        );
        setMessage(
          result.processed
            ? "Done looking for emails. Check the Contacts list below."
            : "Research queued."
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  async function writeEmails() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/nexus/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 7 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Drafting failed");
      if (!data.queued) {
        setMessage(data.message ?? "Nothing to draft");
      } else {
        const result = await runWorker(
          `Writing ${data.queued} email${data.queued === 1 ? "" : "s"}…`
        );
        setMessage(
          result.processed
            ? "Drafts ready — review them below."
            : "Drafts queued."
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setBusy(false);
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      setMessage(
        action === "approve"
          ? "Approved. Nothing sends yet — sending isn’t built."
          : "Rejected"
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
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

  const steps: Array<{
    id: StepId;
    n: number;
    title: string;
    blurb: string;
    ready: boolean;
    detail: string;
  }> = [
    {
      id: "find",
      n: 1,
      title: "Find companies",
      blurb: "Search Google for HOA managers in a city.",
      ready: true,
      detail: `${activeCompanies.length} small local leads`,
    },
    {
      id: "emails",
      n: 2,
      title: "Find emails",
      blurb: "Visit their websites and pull public emails.",
      ready: state.phase2Ready && activeCompanies.length > 0,
      detail:
        pendingResearch > 0
          ? `${pendingResearch} waiting`
          : `${state.contactCount} emails found`,
    },
    {
      id: "write",
      n: 3,
      title: "Write emails",
      blurb: "AI drafts a short cold email with your free-offer link.",
      ready: state.phase2Ready && state.contactCount > 0,
      detail:
        needsDraft > 0
          ? `${needsDraft} ready to draft`
          : `${pendingDrafts.length} waiting for you`,
    },
    {
      id: "review",
      n: 4,
      title: "Review",
      blurb: "Approve or reject. Nothing sends automatically.",
      ready: pendingDrafts.length > 0,
      detail: `${pendingDrafts.length} to review`,
    },
  ];

  return (
    <div className="space-y-6">
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
                in Supabase to unlock email finding and drafting.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          How to use Nexus
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          Four steps. Do them in order.
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-600">
          Find companies → find emails on their sites → write drafts → you
          approve. Emails never send by themselves.
        </p>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const isNext = step.id === nextStep;
            return (
              <li
                key={step.id}
                className={clsx(
                  "rounded-2xl border p-3.5",
                  isNext
                    ? "border-brand-300 bg-brand-50/60"
                    : "border-ink-100 bg-ink-50/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      isNext
                        ? "bg-brand-700 text-white"
                        : "bg-ink-200 text-ink-700"
                    )}
                  >
                    {step.n}
                  </span>
                  <p className="text-sm font-semibold text-ink-900">{step.title}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-600">
                  {step.blurb}
                </p>
                <p className="mt-2 text-[11px] font-medium text-ink-500">
                  {step.detail}
                </p>
              </li>
            );
          })}
        </ol>
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
            (jobsOutstanding ? "Still working in the background…" : message)}
        </p>
      )}

      {/* Step 1 */}
      <Card className={clsx(nextStep === "find" && "ring-2 ring-brand-200")}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">
            <Search className="h-4 w-4 text-ink-700" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold text-ink-900">
              1. Find companies
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              Pick a city. Nexus searches Google, keeps small local HOA managers,
              and drops big nationals.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
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
                onClick={() => void findCompanies()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {busy && nextStep === "find" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Search now
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Step 2 */}
      <Card className={clsx(nextStep === "emails" && "ring-2 ring-brand-200")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">
              <Mail className="h-4 w-4 text-ink-700" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-900">
                2. Find emails
              </h3>
              <p className="mt-1 text-sm text-ink-600">
                Opens each company website and looks for public contact emails.
                {pendingResearch > 0
                  ? ` ${pendingResearch} companies waiting.`
                  : state.contactCount > 0
                    ? ` ${state.contactCount} emails found so far.`
                    : " Find companies first."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={
              busy || !state.phase2Ready || activeCompanies.length === 0
            }
            onClick={() => void findEmails()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {busy && nextStep === "emails" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Find emails
          </button>
        </div>
      </Card>

      {/* Step 3 */}
      <Card className={clsx(nextStep === "write" && "ring-2 ring-brand-200")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">
              <Sparkles className="h-4 w-4 text-ink-700" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-900">
                3. Write emails
              </h3>
              <p className="mt-1 text-sm text-ink-600">
                Writes a short cold email with your free-offer link
                (rideby-ai.vercel.app/free). You still have to approve each one.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !state.phase2Ready || state.contactCount === 0}
            onClick={() => void writeEmails()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {busy && nextStep === "write" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Write drafts
          </button>
        </div>
      </Card>

      {/* Step 4 — drafts */}
      <Card className={clsx(nextStep === "review" && "ring-2 ring-brand-200")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-900">
              4. Review drafts
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              {pendingDrafts.length === 0
                ? "No drafts waiting. Write some in step 3."
                : "Read each one. Approve keeps it for later sending. Reject drops it."}
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

        {pendingDrafts.length > 0 && (
          <ul className="mt-4 space-y-4">
            {pendingDrafts.map((draft) => (
              <li
                key={draft.id}
                className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4"
              >
                <p className="text-sm font-semibold text-ink-900">
                  {draft.company_name ?? "Company"}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  To {draft.to_email}
                  {draft.contact_name ? ` · ${draft.contact_name}` : ""}
                </p>
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
                    Looks good
                  </button>
                  <button
                    type="button"
                    disabled={reviewingId === draft.id}
                    onClick={() =>
                      void reviewDraft(draft.id, "reject", {
                        reason: "Not a fit",
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
                    Wrong email — never contact
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Simple lists */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink-900">
            Your leads
          </h3>
          <span className="text-xs text-ink-500">
            {activeCompanies.length} active
          </span>
        </div>
        {activeCompanies.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            None yet. Search a city in step 1.
          </p>
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
                      "—"}
                    {typeof company.metadata?.userRatingCount === "number"
                      ? ` · ${company.metadata.userRatingCount} reviews`
                      : ""}
                    {company.research_status && company.research_status !== "pending"
                      ? ` · emails: ${company.research_status}`
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
                  {contact.name ?? contact.role ?? "contact"}
                  {" · "}
                  confidence {contact.confidence}
                  {contact.source_url ? (
                    <>
                      {" · "}
                      <a
                        href={contact.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-brand-700 hover:underline"
                      >
                        source page
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {jobsOutstanding && (
        <p className="text-center text-xs text-ink-400">
          Background jobs: {state.queuedCount} waiting
          {state.jobs.some((j) => j.status === "running") ? " · running now" : ""}
          {" · "}
          last activity {relativeTime(state.jobs[0]?.created_at ?? new Date().toISOString())}
        </p>
      )}
    </div>
  );
}
