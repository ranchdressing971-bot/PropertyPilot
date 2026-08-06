"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Wind } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatDate } from "@/lib/format";
import { formatMoneyExact } from "@/lib/profit";

export default function PublicPayPage() {
  const params = useParams<{ token: string }>();
  const { toast } = useToast();
  const { invoices, customers, business, invoiceItems, recordPayment } = useTradeFlow();
  const [paying, setPaying] = useState(false);

  const invoice = invoices.find((i) => i.payment_token === params.token);
  const customer = customers.find((c) => c.id === invoice?.customer_id);
  const items = useMemo(
    () => invoiceItems.filter((i) => i.invoice_id === invoice?.id),
    [invoice?.id, invoiceItems]
  );

  if (!invoice) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">Invoice not found</h1>
          <p className="mt-2 text-sm text-ink-500">
            This payment link may be invalid or the demo data was reset.
          </p>
        </Card>
      </div>
    );
  }

  const balance = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  const paid = invoice.status === "paid" || balance <= 0;

  async function payWithCard() {
    setPaying(true);
    try {
      const res = await fetch("/api/stripe/invoice-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken: invoice!.payment_token,
          amount: balance,
          invoiceNumber: invoice!.invoice_number,
          customerEmail: customer?.email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      // Demo fallback when Stripe isn't configured
      recordPayment(invoice!.id, balance, "card", `pi_demo_${Date.now()}`);
      toast("Payment recorded (demo mode).");
    } catch {
      recordPayment(invoice!.id, balance, "card", `pi_demo_${Date.now()}`);
      toast("Payment recorded (demo mode).");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-cta">
          <Wind className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display font-semibold">{business.name}</p>
          <p className="text-xs text-ink-500">Secure invoice payment</p>
        </div>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge status={invoice.status} />
            <h1 className="mt-2 font-display text-2xl font-semibold">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-ink-500">Due {formatDate(invoice.due_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-400">Amount due</p>
            <p className="stat-value text-3xl">
              {formatMoneyExact(balance, business.currency)}
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2 border-t border-ink-100 pt-4 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.description}</span>
              <span className="font-medium">
                {formatMoneyExact(item.amount, business.currency)}
              </span>
            </li>
          ))}
        </ul>

        {paid ? (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            This invoice is paid. Thank you.
          </p>
        ) : (
          <Button className="mt-6 w-full" size="lg" disabled={paying} onClick={payWithCard}>
            {paying ? "Processing…" : "Pay with card"}
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-ink-400">
          Test mode supported. Card payments use Stripe when configured.
        </p>
      </Card>
    </div>
  );
}
