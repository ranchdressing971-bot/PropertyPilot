"use client";

import {
  DEMO_ACTIVITY,
  DEMO_BUSINESS,
  DEMO_CUSTOMERS,
  DEMO_INVOICE_ITEMS,
  DEMO_INVOICES,
  DEMO_JOBS,
  DEMO_PAYMENTS,
  DEMO_REMINDERS,
  DEMO_STORAGE_KEY,
} from "./data";
import type {
  ActivityLog,
  Business,
  Customer,
  Invoice,
  InvoiceItem,
  Job,
  Payment,
  Reminder,
} from "@/lib/types";

export interface DemoState {
  business: Business;
  customers: Customer[];
  jobs: Job[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  reminders: Reminder[];
  activity: ActivityLog[];
}

function freshState(): DemoState {
  return {
    business: structuredClone(DEMO_BUSINESS),
    customers: structuredClone(DEMO_CUSTOMERS),
    jobs: structuredClone(DEMO_JOBS),
    invoices: structuredClone(DEMO_INVOICES),
    invoiceItems: structuredClone(DEMO_INVOICE_ITEMS),
    payments: structuredClone(DEMO_PAYMENTS),
    reminders: structuredClone(DEMO_REMINDERS),
    activity: structuredClone(DEMO_ACTIVITY),
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === "undefined") return freshState();
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return freshState();
    return { ...freshState(), ...JSON.parse(raw) } as DemoState;
  } catch {
    return freshState();
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("tradeflow-demo-updated"));
}

export function resetDemoState(): DemoState {
  const state = freshState();
  saveDemoState(state);
  return state;
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
