export type MemberRole = "owner" | "admin" | "employee";

export type JobStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type JobInvoiceStatus =
  | "not_invoiced"
  | "draft"
  | "sent"
  | "paid"
  | "cancelled";

export type PhotoKind = "before" | "after";

export type ReminderKind =
  | "on_due_date"
  | "days_3"
  | "days_7"
  | "days_14";

export type ReminderStatus = "pending" | "sent" | "cancelled" | "failed";

export type ActivityType =
  | "customer_created"
  | "job_created"
  | "job_completed"
  | "invoice_sent"
  | "reminder_sent"
  | "payment_received"
  | "invoice_marked_paid";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  active_business_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  default_hourly_labor_rate: number;
  default_tax_rate: number;
  logo_url: string | null;
  currency: string;
  invoice_prefix: string;
  invoice_next_number: number;
  default_payment_terms_days: number;
  default_invoice_note: string | null;
  reminders_enabled: boolean;
  stripe_customer_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_state: string | null;
  service_postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  business_id: string;
  customer_id: string;
  title: string;
  service_type: string;
  description: string | null;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_state: string | null;
  service_postal_code: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  estimated_duration_minutes: number | null;
  status: JobStatus;
  labor_hours: number;
  hourly_labor_rate: number;
  material_cost: number;
  other_expenses: number;
  amount_charged: number;
  internal_notes: string | null;
  customer_notes: string | null;
  assigned_technician_name: string | null;
  invoice_status: JobInvoiceStatus;
  payment_status: PaymentStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobPhoto {
  id: string;
  business_id: string;
  job_id: string;
  kind: PhotoKind;
  url: string;
  caption: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string;
  job_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  payment_token: string;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  business_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  amount: number;
  method: string;
  stripe_payment_id: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  business_id: string;
  invoice_id: string;
  kind: ReminderKind;
  status: ReminderStatus;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  business_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface JobWithCustomer extends Job {
  customer?: Customer | null;
}

export interface InvoiceWithRelations extends Invoice {
  customer?: Customer | null;
  job?: Job | null;
  items?: InvoiceItem[];
}

export interface AttentionItem {
  id: string;
  tone: "warning" | "danger" | "info";
  title: string;
  description: string;
  href: string;
}

export interface DashboardStats {
  revenueThisMonth: number;
  estimatedProfitThisMonth: number;
  outstandingTotal: number;
  jobsCompletedThisMonth: number;
  jobsScheduledToday: number;
  overdueInvoices: number;
  attention: AttentionItem[];
  recentActivity: ActivityLog[];
  upcomingJobs: JobWithCustomer[];
  monthlySeries: { month: string; revenue: number; expenses: number }[];
}

export const SERVICE_TYPES = [
  "AC diagnostic",
  "Compressor replacement",
  "Seasonal maintenance",
  "Thermostat installation",
  "Duct repair",
  "Emergency no-cooling call",
  "Furnace repair",
  "Heat pump service",
  "Filter replacement",
  "System installation",
] as const;

export const JOB_STATUSES: JobStatus[] = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];
