import clsx from "clsx";
import { titleCaseStatus } from "@/lib/format";

const tones: Record<string, string> = {
  draft: "bg-ink-100 text-ink-700",
  scheduled: "bg-brand-50 text-brand-700",
  in_progress: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-ink-100 text-ink-500",
  sent: "bg-brand-50 text-brand-700",
  viewed: "bg-violet-50 text-violet-700",
  partially_paid: "bg-amber-50 text-amber-800",
  paid: "bg-emerald-50 text-emerald-800",
  overdue: "bg-red-50 text-red-700",
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-amber-50 text-amber-800",
  not_invoiced: "bg-signal-50 text-signal-700",
  warning: "bg-signal-50 text-signal-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-800",
};

export function Badge({
  status,
  children,
  className,
}: {
  status: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold",
        tones[status] ?? "bg-ink-100 text-ink-700",
        className
      )}
    >
      {children ?? titleCaseStatus(status)}
    </span>
  );
}
