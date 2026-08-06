"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatDate, titleCaseStatus } from "@/lib/format";
import { formatMoney } from "@/lib/profit";
import { INVOICE_STATUSES } from "@/lib/types";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <InvoicesPageInner />
    </Suspense>
  );
}

function InvoicesPageInner() {
  const searchParams = useSearchParams();
  const { invoices, customers, business } = useTradeFlow();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const filtered = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (status === "unpaid") {
          if (["paid", "cancelled", "draft"].includes(inv.status)) return false;
        } else if (status !== "all" && inv.status !== status) {
          return false;
        }
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const customer = customerMap.get(inv.customer_id);
        return [inv.invoice_number, customer?.full_name, customer?.company_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  }, [customerMap, invoices, query, status]);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="page-title">Invoices</h1>
        <p className="mt-1 text-sm text-ink-500">Send, collect, and track what you&apos;re owed.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          placeholder="Search invoices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          options={[
            { value: "all", label: "All statuses" },
            { value: "unpaid", label: "Unpaid" },
            ...INVOICE_STATUSES.map((s) => ({ value: s, label: titleCaseStatus(s) })),
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={FileText}
          title={status === "unpaid" ? "No unpaid invoices." : "No invoices found."}
          description="Generate an invoice from a completed job."
          actionLabel="View jobs"
          onAction={() => {
            window.location.href = "/dashboard/jobs?status=completed";
          }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const customer = customerMap.get(inv.customer_id);
            const balance = Number(inv.total) - Number(inv.amount_paid);
            return (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
                <Card hover className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{inv.invoice_number}</p>
                    <p className="truncate text-sm text-ink-500">
                      {customer?.full_name ?? "Customer"} · Due {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge status={inv.status} />
                    <p className="mt-2 font-display text-base font-semibold">
                      {formatMoney(balance > 0 ? balance : inv.total, business.currency)}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
