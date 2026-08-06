"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatDate } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { formatMoneyExact } from "@/lib/profit";
import { REMINDER_COPY } from "@/lib/reminders";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const {
    invoices,
    invoiceItems,
    customers,
    jobs,
    business,
    setInvoiceStatus,
    markInvoicePaid,
    cancelInvoice,
    logActivity,
  } = useTradeFlow();
  const [cancelOpen, setCancelOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const invoice = invoices.find((i) => i.id === params.id);
  const customer = customers.find((c) => c.id === invoice?.customer_id);
  const job = jobs.find((j) => j.id === invoice?.job_id);
  const items = useMemo(
    () => invoiceItems.filter((i) => i.invoice_id === params.id),
    [invoiceItems, params.id]
  );

  if (!invoice) {
    return (
      <Card>
        <p className="text-sm text-ink-600">Invoice not found.</p>
        <Link href="/dashboard/invoices" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          Back to invoices
        </Link>
      </Card>
    );
  }

  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${invoice.payment_token}`
      : `/pay/${invoice.payment_token}`;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge status={invoice.status} />
          <h1 className="page-title mt-2">{invoice.invoice_number}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {customer?.full_name ?? "Customer"}
            {job ? ` · ${job.title}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Balance due</p>
          <p className="stat-value text-3xl">
            {formatMoneyExact(Math.max(balance, 0), business.currency)}
          </p>
        </div>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <Button
              onClick={() => {
                setInvoiceStatus(invoice.id, "sent");
                toast("Invoice marked as sent.");
              }}
            >
              Send invoice
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(payUrl);
              toast("Payment link copied.");
            }}
          >
            Copy payment link
          </Button>
          {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
            <Button
              variant="secondary"
              onClick={() => {
                markInvoicePaid(invoice.id, "manual");
                toast("Invoice marked paid.");
              }}
            >
              Mark paid
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              downloadInvoicePdf({ business, customer, invoice, items });
              toast("PDF downloaded.");
            }}
          >
            Download PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.print();
            }}
          >
            Print / preview
          </Button>
          {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
            <Button
              variant="secondary"
              onClick={() => {
                const body = REMINDER_COPY.days_3(
                  invoice.invoice_number,
                  formatMoneyExact(balance, business.currency)
                );
                logActivity("reminder_sent", "Reminder sent", body, {
                  type: "invoice",
                  id: invoice.id,
                });
                toast("Reminder logged. Email provider sends when configured.");
              }}
            >
              Send reminder
            </Button>
          ) : null}
          {invoice.status !== "cancelled" ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel invoice
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        <div ref={previewRef} className="print:p-0">
          <div className="flex flex-wrap justify-between gap-4 border-b border-ink-100 pb-4">
            <div>
              <p className="font-display text-xl font-semibold">{business.name}</p>
              <p className="mt-1 text-sm text-ink-500">
                {[business.address_line1, business.city, business.state, business.postal_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="text-sm text-ink-500">{business.email}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{invoice.invoice_number}</p>
              <p>Issued {formatDate(invoice.issue_date)}</p>
              <p>Due {formatDate(invoice.due_date)}</p>
            </div>
          </div>

          <div className="mt-4 text-sm">
            <p className="font-semibold text-ink-900">Bill to</p>
            <p>{customer?.full_name}</p>
            <p className="text-ink-500">{customer?.email}</p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-ink-50">
                    <td className="py-2.5">{item.description}</td>
                    <td className="py-2.5">{item.quantity}</td>
                    <td className="py-2.5 text-right">
                      {formatMoneyExact(item.amount, business.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Subtotal</span>
              <span>{formatMoneyExact(invoice.subtotal, business.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Tax</span>
              <span>{formatMoneyExact(invoice.tax_amount, business.currency)}</span>
            </div>
            {Number(invoice.discount_amount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-ink-500">Discount</span>
                <span>-{formatMoneyExact(invoice.discount_amount, business.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold">
              <span>Total</span>
              <span>{formatMoneyExact(invoice.total, business.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Paid</span>
              <span>{formatMoneyExact(invoice.amount_paid, business.currency)}</span>
            </div>
          </div>

          {invoice.notes ? (
            <p className="mt-6 text-sm text-ink-600">{invoice.notes}</p>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel invoice?"
        description="Cancelled invoices stay in history but cannot be paid."
        confirmLabel="Cancel invoice"
        danger
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          cancelInvoice(invoice.id);
          setCancelOpen(false);
          toast("Invoice cancelled.");
        }}
      />
    </div>
  );
}
