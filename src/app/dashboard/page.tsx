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
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const currency = business.currency;

  return (
    <div className="animate-fade-in space-y-8">
      <header className="border-b border-ink-200 pb-6">
        <p className="section-label">Today</p>
        <h1 className="page-title mt-2 max-w-xl text-balance">
          Know what got done, who owes you, and what each job made.
        </h1>
      </header>

      {/* Money first — not a grid of icon widgets */}
      <section className="grid gap-8 border-b border-ink-200 pb-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="section-label">Revenue this month</p>
          <p className="stat-value mt-2 text-4xl sm:text-5xl">
            {formatMoney(stats.revenueThisMonth, currency)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="section-label">Est. profit</p>
              <p className="mt-1 font-mono text-xl font-medium text-ink-950">
                {formatMoney(stats.estimatedProfitThisMonth, currency)}
              </p>
            </div>
            <div>
              <p className="section-label">Outstanding</p>
              <p className="mt-1 font-mono text-xl font-medium text-ink-950">
                {formatMoney(stats.outstandingTotal, currency)}
              </p>
            </div>
            <div>
              <p className="section-label">Jobs done</p>
              <p className="mt-1 font-mono text-xl font-medium text-ink-950">
                {stats.jobsCompletedThisMonth}
              </p>
            </div>
            <div>
              <p className="section-label">On the board today</p>
              <p className="mt-1 font-mono text-xl font-medium text-ink-950">
                {stats.jobsScheduledToday}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="section-label">Needs attention</p>
            {stats.overdueInvoices > 0 ? (
              <span className="font-mono text-sm text-red-700">
                {stats.overdueInvoices} overdue
              </span>
            ) : null}
          </div>
          {!stats.attention.length ? (
            <p className="mt-4 text-sm text-ink-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink-100 border-y border-ink-100">
              {stats.attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start justify-between gap-3 py-3.5 transition hover:bg-ink-50/70"
                  >
                    <div>
                      <Badge status={item.tone} />
                      <p className="mt-1.5 text-sm font-semibold text-ink-950">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{item.description}</p>
                    </div>
                    <span className="mt-1 text-ink-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3" padding="md">
          <p className="section-label">Revenue vs expenses</p>
          <p className="mt-1 text-sm text-ink-500">Last 6 months</p>
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlySeries} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#d5dbd6" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#5c685f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#5c685f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `$${Number(v) / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#cfd6d0",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#1f5b51" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#a8b3aa" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="section-label">Upcoming jobs</p>
            <Link href="/dashboard/jobs" className="text-xs font-semibold text-brand-700">
              All jobs
            </Link>
          </div>
          {!stats.upcomingJobs.length ? (
            <p className="text-sm text-ink-500">No upcoming jobs.</p>
          ) : (
            <ul className="divide-y divide-ink-100 border-y border-ink-100">
              {stats.upcomingJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="block py-3.5 transition hover:bg-ink-50/70"
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
                    <p className="mt-1.5 font-mono text-[11px] text-ink-600">
                      {formatDateTime(job.scheduled_date, job.start_time)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">
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
        </div>
      </section>

      <section>
        <p className="section-label">Recent activity</p>
        <ul className="mt-2 divide-y divide-ink-100 border-y border-ink-100">
          {stats.recentActivity.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink-950">{item.title}</p>
                {item.description ? (
                  <p className="text-xs text-ink-500">{item.description}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-mono text-[11px] text-ink-400">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
