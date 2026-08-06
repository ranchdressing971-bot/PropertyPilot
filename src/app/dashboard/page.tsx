"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const currency = business.currency;
  const statsCards = [
    {
      label: "Revenue this month",
      value: formatMoney(stats.revenueThisMonth, currency),
      icon: DollarSign,
    },
    {
      label: "Estimated profit",
      value: formatMoney(stats.estimatedProfitThisMonth, currency),
      icon: TrendingUp,
    },
    {
      label: "Outstanding",
      value: formatMoney(stats.outstandingTotal, currency),
      icon: Clock3,
    },
    {
      label: "Jobs completed",
      value: String(stats.jobsCompletedThisMonth),
      icon: CheckCircle2,
    },
    {
      label: "Jobs today",
      value: String(stats.jobsScheduledToday),
      icon: CalendarDays,
    },
    {
      label: "Overdue invoices",
      value: String(stats.overdueInvoices),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Dashboard</p>
        <h1 className="page-title mt-1 text-balance">
          Know what got done, who owes you, and what each job made.
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="relative overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-ink-500 sm:text-sm">{card.label}</p>
                <Icon className="h-4 w-4 text-brand-600" />
              </div>
              <p className="stat-value mt-3 text-2xl sm:text-3xl">{card.value}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">Needs attention</h2>
          {!stats.attention.length ? (
            <Badge status="success">All clear</Badge>
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
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge status={item.tone}>{item.tone}</Badge>
                      <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{item.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Revenue vs expenses
          </h2>
          <p className="mt-1 text-sm text-ink-500">Last 6 months</p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
                <XAxis dataKey="month" tick={{ fill: "#667991", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#667991", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${Number(v) / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#d9e0ea",
                    boxShadow: "0 8px 24px rgba(17,23,34,0.08)",
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#1f54e8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#b7c3d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upcoming jobs</h2>
            <Link href="/dashboard/jobs" className="text-sm font-semibold text-brand-700">
              View all
            </Link>
          </div>
          {!stats.upcomingJobs.length ? (
            <p className="text-sm text-ink-500">No upcoming jobs.</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcomingJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="block rounded-xl border border-ink-100 px-3 py-2.5 transition hover:border-brand-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {job.customer?.full_name ?? "Customer"}
                        </p>
                        <p className="text-xs text-ink-500">{job.service_type}</p>
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
        <h2 className="font-display text-lg font-semibold">Recent activity</h2>
        <ul className="mt-4 divide-y divide-ink-100">
          {stats.recentActivity.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink-900">{item.title}</p>
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
