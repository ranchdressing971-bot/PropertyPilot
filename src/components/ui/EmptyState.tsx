import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./Button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start border border-dashed border-ink-300 bg-ink-50/40 px-6 py-12">
      <Icon className="h-5 w-5 text-ink-400" />
      <h3 className="mt-4 font-display text-lg font-semibold text-ink-950">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
