"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatAddress, formatDateTime } from "@/lib/format";
import {
  estimatedProfit,
  formatMoney,
  formatMoneyExact,
  laborCost,
  profitMargin,
  totalCost,
} from "@/lib/profit";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const {
    jobs,
    customers,
    business,
    setJobStatus,
    duplicateJob,
    generateInvoiceFromJob,
  } = useTradeFlow();
  const [cancelOpen, setCancelOpen] = useState(false);

  const job = jobs.find((j) => j.id === params.id);
  const customer = customers.find((c) => c.id === job?.customer_id);

  if (!job) {
    return (
      <Card>
        <p className="text-sm text-ink-600">Job not found.</p>
        <Link href="/dashboard/jobs" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          Back to jobs
        </Link>
      </Card>
    );
  }

  const labor = laborCost(job);
  const cost = totalCost(job);
  const profit = estimatedProfit(job);
  const margin = profitMargin(job);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge status={job.status} />
            <Badge status={job.invoice_status} />
            <Badge status={job.payment_status} />
          </div>
          <h1 className="page-title mt-2">{job.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {customer?.full_name ?? "Customer"} · {job.service_type}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/jobs/${job.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicateJob(job.id);
              if (copy) {
                toast("Job duplicated.");
                router.push(`/dashboard/jobs/${copy.id}`);
              }
            }}
          >
            Duplicate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-ink-500">Revenue</p>
          <p className="stat-value mt-2 text-2xl">
            {formatMoney(job.amount_charged, business.currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">Total cost</p>
          <p className="stat-value mt-2 text-2xl">{formatMoney(cost, business.currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">Estimated profit</p>
          <p className={`stat-value mt-2 text-2xl ${profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
            {formatMoney(profit, business.currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">Profit margin</p>
          <p className="stat-value mt-2 text-2xl">
            {margin === null ? "—" : `${margin.toFixed(1)}%`}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {job.status !== "in_progress" && job.status !== "completed" && job.status !== "cancelled" ? (
            <Button onClick={() => { setJobStatus(job.id, "in_progress"); toast("Marked in progress."); }}>
              Mark in progress
            </Button>
          ) : null}
          {job.status !== "completed" && job.status !== "cancelled" ? (
            <Button onClick={() => { setJobStatus(job.id, "completed"); toast("Job completed."); }}>
              Mark completed
            </Button>
          ) : null}
          {job.status === "completed" && job.invoice_status === "not_invoiced" ? (
            <Button
              onClick={() => {
                const invoice = generateInvoiceFromJob(job.id);
                if (invoice) {
                  toast("Invoice draft created.");
                  router.push(`/dashboard/invoices/${invoice.id}`);
                }
              }}
            >
              Generate invoice
            </Button>
          ) : null}
          {job.status !== "cancelled" ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel job
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-ink-400">Schedule</dt>
              <dd className="font-medium">{formatDateTime(job.scheduled_date, job.start_time)}</dd>
            </div>
            <div>
              <dt className="text-ink-400">Address</dt>
              <dd className="font-medium">
                {formatAddress({
                  line1: job.service_address_line1,
                  line2: job.service_address_line2,
                  city: job.service_city,
                  state: job.service_state,
                  postal: job.service_postal_code,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-ink-400">Technician</dt>
              <dd className="font-medium">{job.assigned_technician_name || "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-ink-400">Description</dt>
              <dd className="font-medium">{job.description || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">Cost breakdown</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Labor ({job.labor_hours}h × {formatMoneyExact(job.hourly_labor_rate, business.currency)})</dt>
              <dd className="font-medium">{formatMoneyExact(labor, business.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Materials</dt>
              <dd className="font-medium">{formatMoneyExact(job.material_cost, business.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Other expenses</dt>
              <dd className="font-medium">{formatMoneyExact(job.other_expenses, business.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold">
              <dt>Total cost</dt>
              <dd>{formatMoneyExact(cost, business.currency)}</dd>
            </div>
          </dl>
          {job.internal_notes ? (
            <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
              <span className="font-semibold">Internal: </span>
              {job.internal_notes}
            </p>
          ) : null}
          {job.customer_notes ? (
            <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
              <span className="font-semibold">Customer notes: </span>
              {job.customer_notes}
            </p>
          ) : null}
        </Card>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this job?"
        description="The job will be marked cancelled. You can still view it in history."
        confirmLabel="Cancel job"
        danger
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setJobStatus(job.id, "cancelled");
          setCancelOpen(false);
          toast("Job cancelled.");
        }}
      />
    </div>
  );
}
