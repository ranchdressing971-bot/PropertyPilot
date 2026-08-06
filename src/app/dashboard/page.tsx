"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { formatAddress, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/profit";

export default function DashboardPage() {
  const { ready, business, stats } = useTradeFlow();

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const currency = business.currency;
  const metrics = [
    { label: "Revenue this month", value: formatMoney(stats.revenueThisMonth, currency), span: true },
    { label: "Est. profit", value: formatMoney(stats.estimatedProfitThisMonth, currency) },
    { label: "Outstanding", value: formatMoney(stats.outstandingTotal, currency) },
    { label: "Jobs completed", value: String(stats.jobsCompletedThisMonth) },
    { label: "Jobs today", value: String(stats.jobsScheduledToday) },
    { label: "Overdue invoices", value: String(stats.overdueInvoices) },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <p className="section-label">Dashboard</p>
        <h1 className="page-title mt-1.5 max-w-lg text-balance">
          Know what got done, who owes you, and what each job made.
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <Card
            key={m.label}
            className={m.span ? "col-span-2" : undefined}
            padding="sm"
          >
            <p className="text-xs font-medium text-ink-500">{m.label}</p>
            <p
              className={`mt-2 font-display font-semibold tracking-tight text-ink-950 ${
                m.span ? "text-3xl sm:text-4xl" : "text-2xl"
              }`}
            >
              {m.value}
            </p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink-950">Needs attention</h2>
          {!stats.attention.length ? (
            <span className="text-xs font-medium text-brand-700">All clear</span>
          ) : null}
        </div>
        {!stats.attention.length ? (
          <p className="text-sm text-ink-500">You&apos;re all caught up.</p>
        ) : (
          <ul className="space-y-2">
            {stats.attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/50 px-3.5 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div>
                    <Badge status={item.tone} />
                    <p className="mt-1.5 text-sm font-semibold text-ink-950">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{item.description}</p>
                  </div>
                  <span className="mt-1 text-sm text-ink-300">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Revenue vs expenses
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">Last 6 months</p>
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlySeries} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eae6" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#5c685f", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#5c685f", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickFormatter={(v) => `$${Number(v) / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#d5dbd6",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#247264" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#cfd6d0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Upcoming jobs</h2>
            <Link href="/dashboard/jobs" className="text-xs font-semibold text-brand-700">
              View all
            </Link>
          </div>
          {!stats.upcomingJobs.length ? (
            <p className="text-sm text-ink-500">No upcoming jobs.</p>
          ) : (
            <ul className="space-y-2">
              {stats.upcomingJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="block rounded-xl border border-ink-100 px-3 py-2.5 transition hover:border-brand-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-950">
                          {job.customer?.full_name ?? "Customer"}
                        </p>
                        <p className="truncate text-xs text-ink-500">{job.service_type}</p>
                      </div>
                      <Badge status={job.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-600">
                      {formatDateTime(job.scheduled_date, job.start_time)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-400">
                      {job.assigned_technician_name ?? "Unassigned"} ·{" "}
                      {formatAddress({
                        line1: job.service_address_line1,
                        city: job.service_city,
                        state: job.service_state,
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-base font-semibold">Recent activity</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {stats.recentActivity.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-ink-950">{item.title}</p>
                {item.description ? (
                  <p className="text-xs text-ink-500">{item.description}</p>
                ) : null}
              </div>
              <p className="shrink-0 text-xs text-ink-400">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
