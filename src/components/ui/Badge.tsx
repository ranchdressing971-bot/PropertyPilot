import clsx from "clsx";

const statusStyles: Record<string, string> = {
  "Good Standing": "bg-brand-50 text-brand-800 ring-brand-600/15",
  "Needs Review": "bg-signal-50 text-signal-700 ring-signal-600/15",
  "Violation Sent": "bg-red-50 text-red-700 ring-red-600/10",
  Resolved: "bg-ink-100 text-ink-600 ring-ink-600/10",
  pending: "bg-signal-50 text-signal-700 ring-signal-600/15",
  approved: "bg-brand-50 text-brand-800 ring-brand-600/15",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status] ?? "bg-ink-50 text-ink-600 ring-ink-600/10",
        className
      )}
    >
      {status}
    </span>
  );
}
