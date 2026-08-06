import type { Job } from "./types";

export function laborCost(job: Pick<Job, "labor_hours" | "hourly_labor_rate">): number {
  return roundMoney(Number(job.labor_hours) * Number(job.hourly_labor_rate));
}

export function totalCost(
  job: Pick<Job, "labor_hours" | "hourly_labor_rate" | "material_cost" | "other_expenses">
): number {
  return roundMoney(
    laborCost(job) + Number(job.material_cost) + Number(job.other_expenses)
  );
}

export function estimatedProfit(
  job: Pick<
    Job,
    | "amount_charged"
    | "labor_hours"
    | "hourly_labor_rate"
    | "material_cost"
    | "other_expenses"
  >
): number {
  return roundMoney(Number(job.amount_charged) - totalCost(job));
}

export function profitMargin(
  job: Pick<
    Job,
    | "amount_charged"
    | "labor_hours"
    | "hourly_labor_rate"
    | "material_cost"
    | "other_expenses"
  >
): number | null {
  const charged = Number(job.amount_charged);
  if (!charged) return null;
  return roundMoney((estimatedProfit(job) / charged) * 100);
}

export function hasMissingCostInfo(
  job: Pick<Job, "status" | "labor_hours" | "material_cost" | "amount_charged">
): boolean {
  if (job.status !== "completed" && job.status !== "in_progress") return false;
  return (
    Number(job.amount_charged) <= 0 ||
    (Number(job.labor_hours) <= 0 && Number(job.material_cost) <= 0)
  );
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(
  value: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatMoneyExact(value: number, currency = "USD"): string {
  return formatMoney(value, currency, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
