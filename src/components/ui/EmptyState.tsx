import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel = "Upload inspection",
  actionHref = "/dashboard/inspections/upload",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-white px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-50">
        <Icon className="h-6 w-6 text-ink-400" strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
        {description}
      </p>
      {actionHref && (
        <Link href={actionHref} className="mt-6">
          <Button>{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}
