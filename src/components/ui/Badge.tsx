import clsx from "clsx";

const statusStyles: Record<string, string> = {
  "Good Standing": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Needs Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Violation Sent": "bg-red-50 text-red-700 border-red-200",
  Resolved: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dismissed: "bg-slate-100 text-slate-600 border-slate-200",
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        statusStyles[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      {status}
    </span>
  );
}
