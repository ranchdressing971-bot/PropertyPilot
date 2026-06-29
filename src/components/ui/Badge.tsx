import clsx from "clsx";

const statusStyles: Record<string, string> = {
  "Good Standing": "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  "Needs Review": "bg-amber-50 text-amber-800 ring-amber-200/80",
  "Violation Sent": "bg-red-50 text-red-800 ring-red-200/80",
  Resolved: "bg-ink-100 text-ink-700 ring-ink-200/80",
  pending: "bg-amber-50 text-amber-800 ring-amber-200/80",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  dismissed: "bg-ink-50 text-ink-500 ring-ink-200/80",
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        statusStyles[status] ?? "bg-ink-50 text-ink-600 ring-ink-200/80",
        className
      )}
    >
      {status}
    </span>
  );
}
