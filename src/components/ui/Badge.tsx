import clsx from "clsx";
import { titleCaseStatus } from "@/lib/format";

const tones: Record<string, string> = {
  draft: "text-ink-600",
  scheduled: "text-brand-700",
  in_progress: "text-signal-700",
  completed: "text-brand-800",
  cancelled: "text-ink-400",
  sent: "text-brand-700",
  viewed: "text-ink-700",
  partially_paid: "text-signal-700",
  paid: "text-brand-800",
  overdue: "text-red-700",
  unpaid: "text-red-700",
  partial: "text-signal-700",
  not_invoiced: "text-signal-700",
  warning: "text-signal-700",
  danger: "text-red-700",
  info: "text-brand-700",
  success: "text-brand-800",
};

const dots: Record<string, string> = {
  draft: "bg-ink-400",
  scheduled: "bg-brand-600",
  in_progress: "bg-signal-500",
  completed: "bg-brand-700",
  cancelled: "bg-ink-300",
  sent: "bg-brand-600",
  viewed: "bg-ink-500",
  partially_paid: "bg-signal-500",
  paid: "bg-brand-700",
  overdue: "bg-red-600",
  unpaid: "bg-red-600",
  partial: "bg-signal-500",
  not_invoiced: "bg-signal-500",
  warning: "bg-signal-500",
  danger: "bg-red-600",
  info: "bg-brand-600",
  success: "bg-brand-700",
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
        "inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide",
        tones[status] ?? "text-ink-600",
        className
      )}
    >
      <span
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-sm", dots[status] ?? "bg-ink-400")}
        aria-hidden
      />
      {children ?? titleCaseStatus(status)}
    </span>
  );
}
