"use client";

import { useEffect, useState } from "react";
import type { CompanyRole } from "@/lib/company";

export interface CompanyRoleState {
  loading: boolean;
  role: CompanyRole | null;
  companyId: string | null;
  companyName: string | null;
  hoaName: string | null;
  isAdmin: boolean;
  isInspector: boolean;
}

const EMPTY: CompanyRoleState = {
  loading: true,
  role: null,
  companyId: null,
  companyName: null,
  hoaName: null,
  isAdmin: false,
  isInspector: false,
};

export function useCompanyRole(): CompanyRoleState {
  const [state, setState] = useState<CompanyRoleState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) {
            setState({ ...EMPTY, loading: false });
          }
          return;
        }
        const data = await res.json();
        const role = data.role as CompanyRole;
        if (!cancelled) {
          setState({
            loading: false,
            role,
            companyId: data.companyId ?? null,
            companyName: data.companyName ?? null,
            hoaName: data.hoaName ?? null,
            isAdmin: role === "owner" || role === "admin",
            isInspector: role === "inspector",
          });
        }
      } catch {
        if (!cancelled) setState({ ...EMPTY, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
