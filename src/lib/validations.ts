import { z } from "zod";
import { JOB_STATUSES, SERVICE_TYPES, type JobStatus } from "./types";

export const signUpSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Enter your name"),
});

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const onboardingSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  ownerName: z.string().min(2, "Owner name is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email("Business email is required"),
  addressLine1: z.string().min(3, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(3, "Postal code is required"),
  defaultHourlyLaborRate: z.coerce.number().min(0, "Must be 0 or more"),
  defaultTaxRate: z.coerce.number().min(0).max(100, "Enter tax as a percent, e.g. 7"),
  currency: z.string().min(3).max(3),
  logoUrl: z.string().optional().nullable(),
});

export const customerSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  company_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().or(z.literal("")).nullable(),
  billing_address_line1: z.string().optional().nullable(),
  billing_address_line2: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_state: z.string().optional().nullable(),
  billing_postal_code: z.string().optional().nullable(),
  service_address_line1: z.string().optional().nullable(),
  service_address_line2: z.string().optional().nullable(),
  service_city: z.string().optional().nullable(),
  service_state: z.string().optional().nullable(),
  service_postal_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const jobSchema = z.object({
  customer_id: z.string().min(1, "Select a customer"),
  title: z.string().min(2, "Job title is required"),
  service_type: z.string().min(1, "Select a service type"),
  description: z.string().optional().nullable(),
  service_address_line1: z.string().optional().nullable(),
  service_address_line2: z.string().optional().nullable(),
  service_city: z.string().optional().nullable(),
  service_state: z.string().optional().nullable(),
  service_postal_code: z.string().optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  estimated_duration_minutes: z.coerce.number().optional().nullable(),
  status: z.enum(JOB_STATUSES as [JobStatus, ...JobStatus[]]),
  labor_hours: z.coerce.number().min(0),
  hourly_labor_rate: z.coerce.number().min(0),
  material_cost: z.coerce.number().min(0),
  other_expenses: z.coerce.number().min(0),
  amount_charged: z.coerce.number().min(0),
  internal_notes: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
  assigned_technician_name: z.string().optional().nullable(),
});

export const invoiceSchema = z.object({
  customer_id: z.string().min(1),
  job_id: z.string().optional().nullable(),
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  tax_rate: z.coerce.number().min(0).max(1),
  discount_amount: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unit_price: z.coerce.number().min(0),
      })
    )
    .min(1, "Add at least one line item"),
});

export const businessSettingsSchema = z.object({
  name: z.string().min(2),
  owner_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  default_hourly_labor_rate: z.coerce.number().min(0),
  default_tax_rate: z.coerce.number().min(0).max(1),
  currency: z.string().min(3).max(3),
  invoice_prefix: z.string().min(1).max(12),
  invoice_next_number: z.coerce.number().int().positive(),
  default_payment_terms_days: z.coerce.number().int().min(0),
  default_invoice_note: z.string().optional().nullable(),
  reminders_enabled: z.boolean(),
  logo_url: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export { SERVICE_TYPES };
