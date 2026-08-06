"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatDateTime, titleCaseStatus } from "@/lib/format";
import { formatMoney } from "@/lib/profit";
import { JOB_STATUSES } from "@/lib/types";

export default function JobsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <JobsPageInner />
    </Suspense>
  );
}

function JobsPageInner() {
  const searchParams = useSearchParams();
  const { jobs, customers, business } = useTradeFlow();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => {
        if (status !== "all" && j.status !== status) return false;
        if (searchParams.get("invoice") === "not_invoiced" && j.invoice_status !== "not_invoiced") {
          return false;
        }
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const customer = customerMap.get(j.customer_id);
        return [j.title, j.service_type, j.service_address_line1, customer?.full_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""));
  }, [customerMap, jobs, query, searchParams, status]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200 pb-5">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="mt-1 text-sm text-ink-500">{filtered.length} shown</p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button>
            <Plus className="h-4 w-4" />
            New job
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          placeholder="Search jobs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          options={[
            { value: "all", label: "All statuses" },
            ...JOB_STATUSES.map((s) => ({ value: s, label: titleCaseStatus(s) })),
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet. Create your first job."
          description="Schedule work, track costs, and see profit per job."
          actionLabel="New job"
          onAction={() => {
            window.location.href = "/dashboard/jobs/new";
          }}
        />
      ) : (
        <ul className="divide-y divide-ink-100 border-y border-ink-100">
          {filtered.map((job) => {
            const customer = customerMap.get(job.customer_id);
            return (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-start justify-between gap-3 py-3.5 transition hover:bg-ink-50/70"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-950">{job.title}</p>
                    <p className="text-sm text-ink-500">
                      {customer?.full_name ?? "Customer"} · {job.service_type}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ink-400">
                      {formatDateTime(job.scheduled_date, job.start_time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge status={job.status} />
                    <p className="mt-2 font-mono text-sm font-medium text-ink-950">
                      {formatMoney(job.amount_charged, business.currency)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
