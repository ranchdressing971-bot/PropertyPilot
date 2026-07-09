import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  actionLabel = "Go back",
  actionHref = "/dashboard",
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200/80 bg-white px-8 py-14 text-center shadow-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
        <AlertTriangle className="h-5 w-5 text-red-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">{message}</p>
      <Link href={actionHref} className="mt-6">
        <Button variant="secondary">{actionLabel}</Button>
      </Link>
    </div>
  );
}
