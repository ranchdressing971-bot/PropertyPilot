"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatAddress, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/profit";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { customers, jobs, invoices, business, deleteCustomer } = useTradeFlow();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const customer = customers.find((c) => c.id === params.id);
  const customerJobs = useMemo(
    () => jobs.filter((j) => j.customer_id === params.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [jobs, params.id]
  );
  const customerInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.customer_id === params.id)
        .sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    [invoices, params.id]
  );

  const revenue = customerJobs
    .filter((j) => j.status === "completed")
    .reduce((s, j) => s + Number(j.amount_charged), 0);
  const outstanding = customerInvoices
    .filter((i) => !["paid", "cancelled", "draft"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

  if (!customer) {
    return (
      <Card>
        <p className="text-sm text-ink-600">Customer not found.</p>
        <Link href="/dashboard/customers" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          Back to customers
        </Link>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Customer</p>
          <h1 className="page-title">{customer.full_name}</h1>
          {customer.company_name ? (
            <p className="mt-1 text-sm text-ink-500">{customer.company_name}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/customers/${customer.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium text-ink-500">Total revenue</p>
          <p className="stat-value mt-2 text-3xl">{formatMoney(revenue, business.currency)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-500">Outstanding balance</p>
          <p className="stat-value mt-2 text-3xl">{formatMoney(outstanding, business.currency)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Contact</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-400">Phone</dt>
            <dd className="font-medium text-ink-900">{customer.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Email</dt>
            <dd className="font-medium text-ink-900">{customer.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Billing address</dt>
            <dd className="font-medium text-ink-900">
              {formatAddress({
                line1: customer.billing_address_line1,
                line2: customer.billing_address_line2,
                city: customer.billing_city,
                state: customer.billing_state,
                postal: customer.billing_postal_code,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400">Service address</dt>
            <dd className="font-medium text-ink-900">
              {formatAddress({
                line1: customer.service_address_line1,
                line2: customer.service_address_line2,
                city: customer.service_city,
                state: customer.service_state,
                postal: customer.service_postal_code,
              })}
            </dd>
          </div>
        </dl>
        {customer.notes ? (
          <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">{customer.notes}</p>
        ) : null}
        <p className="mt-3 text-xs text-ink-400">Added {formatDate(customer.created_at)}</p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Job history</h2>
          <Link
            href={`/dashboard/jobs/new?customer=${customer.id}`}
            className="text-sm font-semibold text-brand-700"
          >
            New job
          </Link>
        </div>
        {!customerJobs.length ? (
          <p className="text-sm text-ink-500">No jobs yet.</p>
        ) : (
          <ul className="space-y-2">
            {customerJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 hover:border-brand-200"
                >
                  <div>
                    <p className="text-sm font-semibold">{job.title}</p>
                    <p className="text-xs text-ink-500">{formatDate(job.scheduled_date)}</p>
                  </div>
                  <Badge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Invoice history</h2>
        {!customerInvoices.length ? (
          <p className="mt-2 text-sm text-ink-500">No invoices yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {customerInvoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 hover:border-brand-200"
                >
                  <div>
                    <p className="text-sm font-semibold">{inv.invoice_number}</p>
                    <p className="text-xs text-ink-500">{formatDate(inv.issue_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatMoney(inv.total, business.currency)}
                    </p>
                    <Badge status={inv.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete customer?"
        description="This removes the customer from your book. Jobs and invoices remain for history."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          deleteCustomer(customer.id);
          toast("Customer deleted.");
          router.push("/dashboard/customers");
        }}
      />
    </div>
  );
}
