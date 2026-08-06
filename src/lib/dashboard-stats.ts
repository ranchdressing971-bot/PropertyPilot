import { format, isSameDay, parseISO, startOfMonth, subMonths } from "date-fns";
import { estimatedProfit, hasMissingCostInfo, totalCost } from "./profit";
import type {
  ActivityLog,
  AttentionItem,
  Customer,
  DashboardStats,
  Invoice,
  Job,
  JobWithCustomer,
} from "./types";

export function buildDashboardStats(input: {
  jobs: Job[];
  invoices: Invoice[];
  customers: Customer[];
  activity: ActivityLog[];
  now?: Date;
}): DashboardStats {
  const now = input.now ?? new Date();
  const monthStart = startOfMonth(now);

  const monthJobs = input.jobs.filter(
    (j) =>
      j.status === "completed" &&
      j.completed_at &&
      parseISO(j.completed_at) >= monthStart
  );

  const revenueThisMonth = round(
    monthJobs.reduce((sum, j) => sum + Number(j.amount_charged), 0)
  );
  const estimatedProfitThisMonth = round(
    monthJobs.reduce((sum, j) => sum + estimatedProfit(j), 0)
  );

  const openInvoices = input.invoices.filter(
    (i) => !["paid", "cancelled", "draft"].includes(i.status)
  );
  const outstandingTotal = round(
    openInvoices.reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0)
  );

  const overdueInvoices = input.invoices.filter((i) => i.status === "overdue").length;

  const jobsScheduledToday = input.jobs.filter(
    (j) =>
      j.scheduled_date &&
      isSameDay(parseISO(`${j.scheduled_date}T12:00:00`), now) &&
      !["cancelled", "draft"].includes(j.status)
  ).length;

  const completedNotInvoiced = input.jobs.filter(
    (j) => j.status === "completed" && j.invoice_status === "not_invoiced"
  );
  const completedUnpaid = input.jobs.filter(
    (j) =>
      j.status === "completed" &&
      j.payment_status !== "paid" &&
      Number(j.amount_charged) > 0
  );
  const missingCosts = input.jobs.filter(hasMissingCostInfo);

  const attention: AttentionItem[] = [];
  if (completedNotInvoiced.length) {
    attention.push({
      id: "not-invoiced",
      tone: "warning",
      title: `${completedNotInvoiced.length} completed job${completedNotInvoiced.length === 1 ? "" : "s"} have not been invoiced`,
      description: "Generate invoices so nothing slips through.",
      href: "/dashboard/jobs?status=completed&invoice=not_invoiced",
    });
  }
  if (overdueInvoices) {
    attention.push({
      id: "overdue",
      tone: "danger",
      title: `${overdueInvoices} invoice${overdueInvoices === 1 ? "" : "s"} ${overdueInvoices === 1 ? "is" : "are"} overdue`,
      description: "Send a reminder or follow up by phone.",
      href: "/dashboard/invoices?status=overdue",
    });
  }
  if (missingCosts.length) {
    attention.push({
      id: "missing-costs",
      tone: "info",
      title: `A job has missing cost information`,
      description: `${missingCosts.length} job${missingCosts.length === 1 ? "" : "s"} need labor or material details for accurate profit.`,
      href: "/dashboard/jobs",
    });
  }
  if (completedUnpaid.length) {
    attention.push({
      id: "unpaid-completed",
      tone: "warning",
      title: `A job was completed but not marked paid`,
      description: `${completedUnpaid.length} completed job${completedUnpaid.length === 1 ? "" : "s"} still show unpaid.`,
      href: "/dashboard/jobs?status=completed",
    });
  }

  const customerMap = new Map(input.customers.map((c) => [c.id, c]));
  const upcomingJobs: JobWithCustomer[] = input.jobs
    .filter(
      (j) =>
        j.scheduled_date &&
        ["scheduled", "in_progress"].includes(j.status) &&
        parseISO(`${j.scheduled_date}T12:00:00`) >= new Date(now.toDateString())
    )
    .sort((a, b) => {
      const ad = `${a.scheduled_date ?? ""} ${a.start_time ?? ""}`;
      const bd = `${b.scheduled_date ?? ""} ${b.start_time ?? ""}`;
      return ad.localeCompare(bd);
    })
    .slice(0, 6)
    .map((j) => ({ ...j, customer: customerMap.get(j.customer_id) ?? null }));

  const monthlySeries = Array.from({ length: 6 }, (_, idx) => {
    const month = startOfMonth(subMonths(now, 5 - idx));
    const next = startOfMonth(subMonths(now, 4 - idx));
    const jobsInMonth = input.jobs.filter((j) => {
      if (j.status !== "completed" || !j.completed_at) return false;
      const d = parseISO(j.completed_at);
      return d >= month && d < next;
    });
    return {
      month: format(month, "MMM"),
      revenue: round(jobsInMonth.reduce((s, j) => s + Number(j.amount_charged), 0)),
      expenses: round(jobsInMonth.reduce((s, j) => s + totalCost(j), 0)),
    };
  });

  return {
    revenueThisMonth,
    estimatedProfitThisMonth,
    outstandingTotal,
    jobsCompletedThisMonth: monthJobs.length,
    jobsScheduledToday,
    overdueInvoices,
    attention,
    recentActivity: [...input.activity]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8),
    upcomingJobs,
    monthlySeries,
  };
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
