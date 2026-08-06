"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatMoney } from "@/lib/profit";

export default function CustomersPage() {
  const { customers, invoices, jobs, business } = useTradeFlow();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "outstanding" | "recent">("all");

  const rows = useMemo(() => {
    const enriched = customers.map((c) => {
      const outstanding = invoices
        .filter(
          (i) =>
            i.customer_id === c.id &&
            !["paid", "cancelled", "draft"].includes(i.status)
        )
        .reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0);
      const recentJob = jobs
        .filter((j) => j.customer_id === c.id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      return { customer: c, outstanding, recentAt: recentJob?.updated_at ?? c.created_at };
    });

    return enriched
      .filter(({ customer: c, outstanding }) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          [c.full_name, c.company_name, c.email, c.phone, c.service_address_line1]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        if (!matchesQuery) return false;
        if (filter === "outstanding") return outstanding > 0;
        if (filter === "recent") {
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return new Date(c.updated_at).getTime() >= weekAgo;
        }
        return true;
      })
      .sort((a, b) => a.customer.full_name.localeCompare(b.customer.full_name));
  }, [customers, filter, invoices, jobs, query]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200 pb-5">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="mt-1 text-sm text-ink-500">{customers.length} in the book</p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search customers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1">
          {(
            [
              ["all", "All"],
              ["outstanding", "Owes money"],
              ["recent", "Recent"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                filter === value
                  ? "bg-ink-950 text-white"
                  : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={Users}
          title={query || filter !== "all" ? "No customers found." : "No customers yet."}
          description={
            query || filter !== "all"
              ? "Try a different search or filter."
              : "Add your first customer to start booking jobs."
          }
          actionLabel="Add customer"
          onAction={() => {
            window.location.href = "/dashboard/customers/new";
          }}
        />
      ) : (
        <ul className="divide-y divide-ink-100 border-y border-ink-100">
          {rows.map(({ customer, outstanding }) => (
            <li key={customer.id}>
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="flex items-center justify-between gap-3 py-3.5 transition hover:bg-ink-50/70"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-950">{customer.full_name}</p>
                  <p className="truncate text-sm text-ink-500">
                    {customer.company_name || customer.phone || customer.email || "No contact"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="section-label">Outstanding</p>
                  <p className="font-mono text-sm font-medium text-ink-950">
                    {formatMoney(outstanding, business.currency)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
