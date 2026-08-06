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
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
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
