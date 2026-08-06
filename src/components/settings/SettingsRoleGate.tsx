"use client";

import { useCompanyRole } from "@/hooks/useCompanyRole";

/** Renders children only for owner/admin. Inspectors see nothing. */
export function SettingsRoleGate({
  children,
  adminOnly = true,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { loading, isAdmin, isInspector } = useCompanyRole();

  if (loading) return null;
  if (adminOnly && !isAdmin) {
    if (isInspector) {
      return (
        <p className="rounded-xl border border-ink-100 bg-ink-50/80 px-4 py-3 text-sm text-ink-600">
          Inspector access: run inspections and manage the shared property roster.
          Billing and community settings are limited to admins.
        </p>
      );
    }
    return null;
  }

  return <div className="space-y-5">{children}</div>;
}
