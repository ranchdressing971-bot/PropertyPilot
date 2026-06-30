import clsx from "clsx";

const statusStyles: Record<string, string> = {
  "Good Standing": "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  "Needs Review": "bg-amber-50 text-amber-800 ring-amber-600/10",
  "Violation Sent": "bg-red-50 text-red-700 ring-red-600/10",
  Resolved: "bg-ink-100 text-ink-600 ring-ink-600/10",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/10",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  dismissed: "bg-ink-50 text-ink-500 ring-ink-600/10",
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status] ?? "bg-ink-50 text-ink-600 ring-ink-600/10",
        className
      )}
    >
      {status}
    </span>
  );
}
