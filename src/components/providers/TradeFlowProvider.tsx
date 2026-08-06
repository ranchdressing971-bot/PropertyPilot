"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { addDays, formatISO } from "date-fns";
import { buildDashboardStats } from "@/lib/dashboard-stats";
import {
  DEMO_MODE_COOKIE,
  DEMO_BUSINESS,
} from "@/lib/demo/data";
import {
  loadDemoState,
  newId,
  resetDemoState,
  saveDemoState,
  type DemoState,
} from "@/lib/demo/store";
import { roundMoney } from "@/lib/profit";
import type {
  ActivityLog,
  ActivityType,
  Business,
  Customer,
  DashboardStats,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Job,
  JobStatus,
  Payment,
} from "@/lib/types";
import type { CustomerInput, JobInput } from "@/lib/validations";

type Mode = "demo" | "live";

interface TradeFlowContextValue {
  mode: Mode;
  ready: boolean;
  business: Business;
  customers: Customer[];
  jobs: Job[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  activity: ActivityLog[];
  stats: DashboardStats;
  enterDemo: () => void;
  exitDemo: () => void;
  resetDemo: () => void;
  updateBusiness: (patch: Partial<Business>) => void;
  createCustomer: (input: CustomerInput) => Customer;
  updateCustomer: (id: string, input: CustomerInput) => void;
  deleteCustomer: (id: string) => void;
  createJob: (input: JobInput) => Job;
  updateJob: (id: string, input: Partial<Job>) => void;
  duplicateJob: (id: string) => Job | null;
  setJobStatus: (id: string, status: JobStatus) => void;
  deleteJob: (id: string) => void;
  generateInvoiceFromJob: (jobId: string) => Invoice | null;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  setInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  markInvoicePaid: (id: string, method?: string) => void;
  cancelInvoice: (id: string) => void;
  recordPayment: (invoiceId: string, amount: number, method: string, stripeId?: string) => void;
  logActivity: (
    type: ActivityType,
    title: string,
    description?: string,
    entity?: { type: string; id: string }
  ) => void;
  searchAll: (query: string) => {
    customers: Customer[];
    jobs: Job[];
    invoices: Invoice[];
  };
}

const TradeFlowContext = createContext<TradeFlowContextValue | null>(null);

function setModeCookie(mode: Mode) {
  document.cookie = `${DEMO_MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function TradeFlowProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("demo");
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<DemoState>(() => loadDemoState());

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${DEMO_MODE_COOKIE}=`))
      ?.split("=")[1] as Mode | undefined;
    setMode(cookie === "live" ? "live" : "demo");
    setState(loadDemoState());
    setReady(true);

    const onUpdate = () => setState(loadDemoState());
    window.addEventListener("tradeflow-demo-updated", onUpdate);
    return () => window.removeEventListener("tradeflow-demo-updated", onUpdate);
  }, []);

  const commit = useCallback((next: DemoState) => {
    setState(next);
    saveDemoState(next);
  }, []);

  const logActivity = useCallback(
    (
      type: ActivityType,
      title: string,
      description?: string,
      entity?: { type: string; id: string }
    ) => {
      setState((prev) => {
        const entry: ActivityLog = {
          id: newId("a"),
          business_id: prev.business.id,
          type,
          title,
          description: description ?? null,
          entity_type: entity?.type ?? null,
          entity_id: entity?.id ?? null,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const next = { ...prev, activity: [entry, ...prev.activity] };
        saveDemoState(next);
        return next;
      });
    },
    []
  );

  const value = useMemo<TradeFlowContextValue>(() => {
    const stats = buildDashboardStats({
      jobs: state.jobs,
      invoices: state.invoices,
      customers: state.customers,
      activity: state.activity,
    });

    return {
      mode,
      ready,
      business: state.business,
      customers: state.customers,
      jobs: state.jobs,
      invoices: state.invoices,
      invoiceItems: state.invoiceItems,
      payments: state.payments,
      activity: state.activity,
      stats,
      enterDemo: () => {
        setModeCookie("demo");
        setMode("demo");
        commit(loadDemoState());
      },
      exitDemo: () => {
        setModeCookie("live");
        setMode("live");
      },
      resetDemo: () => {
        commit(resetDemoState());
      },
      updateBusiness: (patch) => {
        commit({
          ...state,
          business: {
            ...state.business,
            ...patch,
            updated_at: new Date().toISOString(),
          },
        });
      },
      createCustomer: (input) => {
        const customer: Customer = {
          id: newId("c"),
          business_id: state.business.id,
          full_name: input.full_name,
          company_name: input.company_name || null,
          phone: input.phone || null,
          email: input.email || null,
          billing_address_line1: input.billing_address_line1 || null,
          billing_address_line2: input.billing_address_line2 || null,
          billing_city: input.billing_city || null,
          billing_state: input.billing_state || null,
          billing_postal_code: input.billing_postal_code || null,
          service_address_line1: input.service_address_line1 || null,
          service_address_line2: input.service_address_line2 || null,
          service_city: input.service_city || null,
          service_state: input.service_state || null,
          service_postal_code: input.service_postal_code || null,
          notes: input.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commit({ ...state, customers: [customer, ...state.customers] });
        logActivity("customer_created", "Customer added", customer.full_name, {
          type: "customer",
          id: customer.id,
        });
        return customer;
      },
      updateCustomer: (id, input) => {
        commit({
          ...state,
          customers: state.customers.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...input,
                  company_name: input.company_name || null,
                  phone: input.phone || null,
                  email: input.email || null,
                  updated_at: new Date().toISOString(),
                }
              : c
          ),
        });
      },
      deleteCustomer: (id) => {
        commit({
          ...state,
          customers: state.customers.filter((c) => c.id !== id),
        });
      },
      createJob: (input) => {
        const job: Job = {
          id: newId("j"),
          business_id: state.business.id,
          customer_id: input.customer_id,
          title: input.title,
          service_type: input.service_type,
          description: input.description || null,
          service_address_line1: input.service_address_line1 || null,
          service_address_line2: input.service_address_line2 || null,
          service_city: input.service_city || null,
          service_state: input.service_state || null,
          service_postal_code: input.service_postal_code || null,
          scheduled_date: input.scheduled_date || null,
          start_time: input.start_time || null,
          estimated_duration_minutes: input.estimated_duration_minutes ?? null,
          status: (input.status as JobStatus) || "scheduled",
          labor_hours: Number(input.labor_hours) || 0,
          hourly_labor_rate:
            Number(input.hourly_labor_rate) || state.business.default_hourly_labor_rate,
          material_cost: Number(input.material_cost) || 0,
          other_expenses: Number(input.other_expenses) || 0,
          amount_charged: Number(input.amount_charged) || 0,
          internal_notes: input.internal_notes || null,
          customer_notes: input.customer_notes || null,
          assigned_technician_name: input.assigned_technician_name || null,
          invoice_status: "not_invoiced",
          payment_status: "unpaid",
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commit({ ...state, jobs: [job, ...state.jobs] });
        const customer = state.customers.find((c) => c.id === job.customer_id);
        logActivity(
          "job_created",
          "Job created",
          `${job.title}${customer ? ` · ${customer.full_name}` : ""}`,
          { type: "job", id: job.id }
        );
        return job;
      },
      updateJob: (id, input) => {
        commit({
          ...state,
          jobs: state.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  ...input,
                  updated_at: new Date().toISOString(),
                }
              : j
          ),
        });
      },
      duplicateJob: (id) => {
        const source = state.jobs.find((j) => j.id === id);
        if (!source) return null;
        const job: Job = {
          ...structuredClone(source),
          id: newId("j"),
          title: `${source.title} (copy)`,
          status: "draft",
          invoice_status: "not_invoiced",
          payment_status: "unpaid",
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commit({ ...state, jobs: [job, ...state.jobs] });
        return job;
      },
      setJobStatus: (id, status) => {
        commit({
          ...state,
          jobs: state.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status,
                  completed_at:
                    status === "completed"
                      ? new Date().toISOString()
                      : status === "cancelled"
                        ? j.completed_at
                        : null,
                  updated_at: new Date().toISOString(),
                }
              : j
          ),
        });
        if (status === "completed") {
          const job = state.jobs.find((j) => j.id === id);
          logActivity("job_completed", "Job completed", job?.title, {
            type: "job",
            id,
          });
        }
      },
      deleteJob: (id) => {
        commit({ ...state, jobs: state.jobs.filter((j) => j.id !== id) });
      },
      generateInvoiceFromJob: (jobId) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (!job) return null;
        const issue = formatISO(new Date(), { representation: "date" });
        const due = formatISO(
          addDays(new Date(), state.business.default_payment_terms_days),
          { representation: "date" }
        );
        const subtotal = roundMoney(Number(job.amount_charged));
        const tax_rate = state.business.default_tax_rate;
        const tax_amount = roundMoney(subtotal * tax_rate);
        const total = roundMoney(subtotal + tax_amount);
        const number = `${state.business.invoice_prefix}-${state.business.invoice_next_number}`;
        const invoice: Invoice = {
          id: newId("i"),
          business_id: state.business.id,
          customer_id: job.customer_id,
          job_id: job.id,
          invoice_number: number,
          issue_date: issue,
          due_date: due,
          status: "draft",
          subtotal,
          tax_rate,
          tax_amount,
          discount_amount: 0,
          total,
          amount_paid: 0,
          notes: state.business.default_invoice_note,
          payment_token: `pay_${newId("t").replace(/-/g, "").slice(0, 16)}`,
          stripe_payment_intent_id: null,
          paid_at: null,
          sent_at: null,
          viewed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const item: InvoiceItem = {
          id: newId("ii"),
          business_id: state.business.id,
          invoice_id: invoice.id,
          description: job.title,
          quantity: 1,
          unit_price: subtotal,
          amount: subtotal,
          sort_order: 0,
          created_at: invoice.created_at,
          updated_at: invoice.updated_at,
        };
        commit({
          ...state,
          business: {
            ...state.business,
            invoice_next_number: state.business.invoice_next_number + 1,
          },
          invoices: [invoice, ...state.invoices],
          invoiceItems: [item, ...state.invoiceItems],
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? { ...j, invoice_status: "draft", updated_at: new Date().toISOString() }
              : j
          ),
        });
        return invoice;
      },
      updateInvoice: (id, patch) => {
        commit({
          ...state,
          invoices: state.invoices.map((i) =>
            i.id === id ? { ...i, ...patch, updated_at: new Date().toISOString() } : i
          ),
        });
      },
      setInvoiceStatus: (id, status) => {
        const invoice = state.invoices.find((i) => i.id === id);
        commit({
          ...state,
          invoices: state.invoices.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status,
                  sent_at:
                    status === "sent" && !i.sent_at
                      ? new Date().toISOString()
                      : i.sent_at,
                  updated_at: new Date().toISOString(),
                }
              : i
          ),
          jobs: state.jobs.map((j) =>
            invoice?.job_id && j.id === invoice.job_id
              ? {
                  ...j,
                  invoice_status:
                    status === "paid"
                      ? "paid"
                      : status === "cancelled"
                        ? "cancelled"
                        : status === "draft"
                          ? "draft"
                          : "sent",
                }
              : j
          ),
        });
        if (status === "sent" && invoice) {
          logActivity("invoice_sent", "Invoice sent", invoice.invoice_number, {
            type: "invoice",
            id,
          });
        }
      },
      markInvoicePaid: (id, method = "manual") => {
        const invoice = state.invoices.find((i) => i.id === id);
        if (!invoice) return;
        const payment: Payment = {
          id: newId("p"),
          business_id: state.business.id,
          invoice_id: id,
          amount: roundMoney(Number(invoice.total) - Number(invoice.amount_paid)),
          method,
          stripe_payment_id: null,
          paid_at: new Date().toISOString(),
          notes: "Marked paid manually",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commit({
          ...state,
          invoices: state.invoices.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "paid",
                  amount_paid: i.total,
                  paid_at: payment.paid_at,
                  updated_at: payment.paid_at,
                }
              : i
          ),
          payments: [payment, ...state.payments],
          jobs: state.jobs.map((j) =>
            invoice.job_id && j.id === invoice.job_id
              ? { ...j, payment_status: "paid", invoice_status: "paid" }
              : j
          ),
        });
        logActivity(
          "invoice_marked_paid",
          "Invoice marked paid",
          invoice.invoice_number,
          { type: "invoice", id }
        );
      },
      cancelInvoice: (id) => {
        const invoice = state.invoices.find((i) => i.id === id);
        commit({
          ...state,
          invoices: state.invoices.map((i) =>
            i.id === id
              ? { ...i, status: "cancelled", updated_at: new Date().toISOString() }
              : i
          ),
          jobs: state.jobs.map((j) =>
            invoice?.job_id && j.id === invoice.job_id
              ? { ...j, invoice_status: "cancelled" }
              : j
          ),
        });
      },
      recordPayment: (invoiceId, amount, method, stripeId) => {
        const invoice = state.invoices.find((i) => i.id === invoiceId);
        if (!invoice) return;
        const paid = roundMoney(Number(invoice.amount_paid) + amount);
        const status: InvoiceStatus =
          paid >= Number(invoice.total)
            ? "paid"
            : paid > 0
              ? "partially_paid"
              : invoice.status;
        const payment: Payment = {
          id: newId("p"),
          business_id: state.business.id,
          invoice_id: invoiceId,
          amount: roundMoney(amount),
          method,
          stripe_payment_id: stripeId ?? null,
          paid_at: new Date().toISOString(),
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        commit({
          ...state,
          invoices: state.invoices.map((i) =>
            i.id === invoiceId
              ? {
                  ...i,
                  amount_paid: paid,
                  status,
                  paid_at: status === "paid" ? payment.paid_at : i.paid_at,
                  stripe_payment_intent_id: stripeId ?? i.stripe_payment_intent_id,
                  updated_at: payment.paid_at,
                }
              : i
          ),
          payments: [payment, ...state.payments],
          jobs: state.jobs.map((j) =>
            invoice.job_id && j.id === invoice.job_id
              ? {
                  ...j,
                  payment_status:
                    status === "paid" ? "paid" : status === "partially_paid" ? "partial" : j.payment_status,
                  invoice_status: status === "paid" ? "paid" : j.invoice_status,
                }
              : j
          ),
        });
        logActivity(
          "payment_received",
          "Payment received",
          `${invoice.invoice_number} · $${amount.toFixed(2)}`,
          { type: "invoice", id: invoiceId }
        );
      },
      logActivity,
      searchAll: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return { customers: [], jobs: [], invoices: [] };
        return {
          customers: state.customers.filter((c) =>
            [c.full_name, c.company_name, c.email, c.phone, c.service_address_line1]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          ),
          jobs: state.jobs.filter((j) =>
            [
              j.title,
              j.service_type,
              j.service_address_line1,
              j.assigned_technician_name,
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          ),
          invoices: state.invoices.filter((i) =>
            [i.invoice_number, i.notes]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          ),
        };
      },
    };
  }, [commit, logActivity, mode, ready, state]);

  return (
    <TradeFlowContext.Provider value={value}>{children}</TradeFlowContext.Provider>
  );
}

export function useTradeFlow() {
  const ctx = useContext(TradeFlowContext);
  if (!ctx) throw new Error("useTradeFlow must be used within TradeFlowProvider");
  return ctx;
}

export { DEMO_BUSINESS };
