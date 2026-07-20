"use client";

/**
 * Shell lives in `app/dashboard/layout.tsx` so route transitions stay mounted.
 * This wrapper remains for existing page imports — pass-through only.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
