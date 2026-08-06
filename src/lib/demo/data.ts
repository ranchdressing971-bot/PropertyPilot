import {
  addDays,
  formatISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
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

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const now = new Date();
const today = formatISO(now, { representation: "date" });
const monthStart = startOfMonth(now);

function iso(d: Date): string {
  return d.toISOString();
}

function dateStr(d: Date): string {
  return formatISO(d, { representation: "date" });
}

function uid(n: number, prefix = "c"): string {
  return `${prefix}${String(n).padStart(7, "0")}-0000-4000-8000-000000000000`.slice(0, 36);
}

export const DEMO_BUSINESS: Business = {
  id: BUSINESS_ID,
  name: "Coastal Air & Heating",
  owner_name: "Marcus Hale",
  phone: "(843) 555-0142",
  email: "marcus@coastalair.demo",
  address_line1: "418 Harbor View Dr",
  address_line2: "Suite 200",
  city: "Charleston",
  state: "SC",
  postal_code: "29401",
  country: "US",
  default_hourly_labor_rate: 125,
  default_tax_rate: 0.07,
  logo_url: null,
  currency: "USD",
  invoice_prefix: "CAH",
  invoice_next_number: 1042,
  default_payment_terms_days: 14,
  default_invoice_note: "Thank you for trusting Coastal Air & Heating. Payment is due within the terms shown.",
  reminders_enabled: true,
  stripe_customer_id: null,
  onboarding_completed: true,
  created_at: iso(subMonths(now, 14)),
  updated_at: iso(now),
};

const customerSeeds: Array<Omit<Customer, "business_id" | "created_at" | "updated_at">> = [
  { id: uid(1), full_name: "Elena Vargas", company_name: null, phone: "(843) 555-2201", email: "elena.vargas@email.com", billing_address_line1: "12 Magnolia St", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29403", service_address_line1: "12 Magnolia St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29403", notes: "Prefers morning appointments." },
  { id: uid(2), full_name: "James Whitaker", company_name: "Whitaker Properties", phone: "(843) 555-2202", email: "james@whitakerprops.com", billing_address_line1: "880 King St", billing_address_line2: "Floor 3", billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29403", service_address_line1: "45 Rutledge Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", notes: "Property manager — send invoices to accounting." },
  { id: uid(3), full_name: "Priya Nair", company_name: null, phone: "(843) 555-2203", email: "priya.nair@email.com", billing_address_line1: "7 Battery Ln", billing_address_line2: null, billing_city: "Mount Pleasant", billing_state: "SC", billing_postal_code: "29464", service_address_line1: "7 Battery Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", notes: null },
  { id: uid(4), full_name: "Robert Chen", company_name: "Harbor Dental", phone: "(843) 555-2204", email: "ops@harbordental.com", billing_address_line1: "210 East Bay St", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29401", service_address_line1: "210 East Bay St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", notes: "After-hours access code on file." },
  { id: uid(5), full_name: "Sofia Alvarez", company_name: null, phone: "(843) 555-2205", email: "sofia.a@email.com", billing_address_line1: "91 Folly Rd", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29412", service_address_line1: "91 Folly Rd", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29412", notes: null },
  { id: uid(6), full_name: "David Okonkwo", company_name: null, phone: "(843) 555-2206", email: "david.oko@email.com", billing_address_line1: "33 Shem Creek Way", billing_address_line2: null, billing_city: "Mount Pleasant", billing_state: "SC", billing_postal_code: "29464", service_address_line1: "33 Shem Creek Way", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", notes: "Has two systems — upstairs and downstairs." },
  { id: uid(7), full_name: "Hannah Brooks", company_name: "Brooks Cafe", phone: "(843) 555-2207", email: "hannah@brookscafe.com", billing_address_line1: "55 Market St", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29401", service_address_line1: "55 Market St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", notes: "Schedule before 8am opening." },
  { id: uid(8), full_name: "Tom Reynolds", company_name: null, phone: "(843) 555-2208", email: "tom.reynolds@email.com", billing_address_line1: "140 Isle of Palms Dr", billing_address_line2: null, billing_city: "Isle of Palms", billing_state: "SC", billing_postal_code: "29451", service_address_line1: "140 Isle of Palms Dr", service_address_line2: null, service_city: "Isle of Palms", service_state: "SC", service_postal_code: "29451", notes: null },
  { id: uid(9), full_name: "Claire Fontaine", company_name: null, phone: "(843) 555-2209", email: "claire.f@email.com", billing_address_line1: "6 Tradd St", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29401", service_address_line1: "6 Tradd St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", notes: "Historic home — careful with attic access." },
  { id: uid(10), full_name: "Miguel Santos", company_name: "Santos Realty", phone: "(843) 555-2210", email: "miguel@santosrealty.com", billing_address_line1: "300 Coleman Blvd", billing_address_line2: null, billing_city: "Mount Pleasant", billing_state: "SC", billing_postal_code: "29464", service_address_line1: "18 Sea Island Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", notes: "Vacant rental — lockbox code in notes app." },
  { id: uid(11), full_name: "Amy Patel", company_name: null, phone: "(843) 555-2211", email: "amy.patel@email.com", billing_address_line1: "72 Ashley Ave", billing_address_line2: null, billing_city: "Charleston", billing_state: "SC", billing_postal_code: "29407", service_address_line1: "72 Ashley Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29407", notes: null },
  { id: uid(12), full_name: "Greg Nolan", company_name: "Nolan Storage", phone: "(843) 555-2212", email: "greg@nolanstorage.com", billing_address_line1: "900 Remount Rd", billing_address_line2: null, billing_city: "North Charleston", billing_state: "SC", billing_postal_code: "29406", service_address_line1: "900 Remount Rd", service_address_line2: "Bldg C", service_city: "North Charleston", service_state: "SC", service_postal_code: "29406", notes: "Commercial unit — ask for bay 4." },
];

export const DEMO_CUSTOMERS: Customer[] = customerSeeds.map((c, i) => ({
  ...c,
  business_id: BUSINESS_ID,
  created_at: iso(subDays(now, 40 - i * 2)),
  updated_at: iso(subDays(now, 10 - (i % 5))),
}));

type JobSeed = Omit<Job, "business_id" | "created_at" | "updated_at">;

/** Tuned so completed jobs this month sum to ~$18,420 revenue and ~$5,360 profit. */
const jobSeeds: JobSeed[] = [
  // 4 jobs scheduled today
  { id: uid(1, "j"), customer_id: uid(1), title: "Morning AC diagnostic", service_type: "AC diagnostic", description: "Unit not cooling upstairs.", service_address_line1: "12 Magnolia St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29403", scheduled_date: today, start_time: "08:30", estimated_duration_minutes: 90, status: "scheduled", labor_hours: 0, hourly_labor_rate: 125, material_cost: 0, other_expenses: 0, amount_charged: 149, internal_notes: null, customer_notes: "Call on arrival.", assigned_technician_name: "Alex Rivera", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },
  { id: uid(2, "j"), customer_id: uid(4), title: "Office thermostat install", service_type: "Thermostat installation", description: "Replace lobby thermostat with smart model.", service_address_line1: "210 East Bay St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: today, start_time: "10:30", estimated_duration_minutes: 120, status: "scheduled", labor_hours: 0, hourly_labor_rate: 125, material_cost: 180, other_expenses: 0, amount_charged: 420, internal_notes: "Bring Nest Pro.", customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },
  { id: uid(3, "j"), customer_id: uid(7), title: "Cafe seasonal maintenance", service_type: "Seasonal maintenance", description: "Pre-summer tune-up.", service_address_line1: "55 Market St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: today, start_time: "13:00", estimated_duration_minutes: 120, status: "in_progress", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 45, other_expenses: 0, amount_charged: 289, internal_notes: null, customer_notes: "Before opening if possible.", assigned_technician_name: "Alex Rivera", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },
  { id: uid(4, "j"), customer_id: uid(10), title: "Rental duct repair", service_type: "Duct repair", description: "Leak in hallway return.", service_address_line1: "18 Sea Island Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: today, start_time: "15:30", estimated_duration_minutes: 150, status: "scheduled", labor_hours: 0, hourly_labor_rate: 125, material_cost: 95, other_expenses: 0, amount_charged: 560, internal_notes: "Lockbox 4821", customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },

  // Completed this month — revenue target $18,420
  { id: uid(5, "j"), customer_id: uid(2), title: "Compressor replacement", service_type: "Compressor replacement", description: "Failed compressor on 3-ton unit.", service_address_line1: "45 Rutledge Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 2)), start_time: "09:00", estimated_duration_minutes: 300, status: "completed", labor_hours: 5, hourly_labor_rate: 125, material_cost: 980, other_expenses: 40, amount_charged: 2480, internal_notes: "Warranty parts used.", customer_notes: "System under warranty on compressor.", assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 2)) },
  { id: uid(6, "j"), customer_id: uid(3), title: "Emergency no-cooling", service_type: "Emergency no-cooling call", description: "After-hours no cool.", service_address_line1: "7 Battery Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: dateStr(addDays(monthStart, 3)), start_time: "19:00", estimated_duration_minutes: 120, status: "completed", labor_hours: 2.5, hourly_labor_rate: 165, material_cost: 85, other_expenses: 25, amount_charged: 690, internal_notes: "Capacitor + contactor.", customer_notes: null, assigned_technician_name: "Alex Rivera", invoice_status: "sent", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 3)) },
  { id: uid(7, "j"), customer_id: uid(5), title: "Seasonal maintenance", service_type: "Seasonal maintenance", description: "Spring maintenance visit.", service_address_line1: "91 Folly Rd", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29412", scheduled_date: dateStr(addDays(monthStart, 4)), start_time: "11:00", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 35, other_expenses: 0, amount_charged: 249, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 4)) },
  { id: uid(8, "j"), customer_id: uid(6), title: "Upstairs heat pump service", service_type: "Heat pump service", description: "Noisy outdoor unit.", service_address_line1: "33 Shem Creek Way", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: dateStr(addDays(monthStart, 5)), start_time: "14:00", estimated_duration_minutes: 150, status: "completed", labor_hours: 2.5, hourly_labor_rate: 125, material_cost: 120, other_expenses: 15, amount_charged: 580, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 5)) },
  { id: uid(9, "j"), customer_id: uid(8), title: "Thermostat installation", service_type: "Thermostat installation", description: "Ecobee install.", service_address_line1: "140 Isle of Palms Dr", service_address_line2: null, service_city: "Isle of Palms", service_state: "SC", service_postal_code: "29451", scheduled_date: dateStr(addDays(monthStart, 6)), start_time: "10:00", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 210, other_expenses: 0, amount_charged: 450, internal_notes: null, customer_notes: "Show customer app setup.", assigned_technician_name: "Alex Rivera", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 6)) },
  { id: uid(10, "j"), customer_id: uid(9), title: "Duct repair", service_type: "Duct repair", description: "Seal attic duct joints.", service_address_line1: "6 Tradd St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 7)), start_time: "09:30", estimated_duration_minutes: 180, status: "completed", labor_hours: 3, hourly_labor_rate: 125, material_cost: 160, other_expenses: 20, amount_charged: 780, internal_notes: "Bring extra mastic.", customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "overdue" as never, payment_status: "unpaid", completed_at: iso(addDays(monthStart, 7)) },
  { id: uid(11, "j"), customer_id: uid(11), title: "Furnace repair", service_type: "Furnace repair", description: "Ignitor failure.", service_address_line1: "72 Ashley Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29407", scheduled_date: dateStr(addDays(monthStart, 8)), start_time: "13:00", estimated_duration_minutes: 120, status: "completed", labor_hours: 2, hourly_labor_rate: 125, material_cost: 95, other_expenses: 0, amount_charged: 420, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 8)) },
  { id: uid(12, "j"), customer_id: uid(12), title: "Commercial filter + coil clean", service_type: "Seasonal maintenance", description: "Quarterly maintenance.", service_address_line1: "900 Remount Rd", service_address_line2: "Bldg C", service_city: "North Charleston", service_state: "SC", service_postal_code: "29406", scheduled_date: dateStr(addDays(monthStart, 9)), start_time: "08:00", estimated_duration_minutes: 180, status: "completed", labor_hours: 3, hourly_labor_rate: 125, material_cost: 140, other_expenses: 30, amount_charged: 890, internal_notes: null, customer_notes: "Invoice to AP.", assigned_technician_name: "Alex Rivera", invoice_status: "sent", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 9)) },
  { id: uid(13, "j"), customer_id: uid(1), title: "Capacitor replacement", service_type: "AC diagnostic", description: "Weak start capacitor.", service_address_line1: "12 Magnolia St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29403", scheduled_date: dateStr(addDays(monthStart, 10)), start_time: "15:00", estimated_duration_minutes: 75, status: "completed", labor_hours: 1, hourly_labor_rate: 125, material_cost: 42, other_expenses: 0, amount_charged: 245, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 10)) },
  { id: uid(14, "j"), customer_id: uid(2), title: "Multi-unit maintenance", service_type: "Seasonal maintenance", description: "Three units at rental property.", service_address_line1: "45 Rutledge Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 11)), start_time: "09:00", estimated_duration_minutes: 240, status: "completed", labor_hours: 4, hourly_labor_rate: 125, material_cost: 110, other_expenses: 20, amount_charged: 1120, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 11)) },
  { id: uid(15, "j"), customer_id: uid(4), title: "Server room AC diagnostic", service_type: "AC diagnostic", description: "Warm spots near server closet.", service_address_line1: "210 East Bay St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 12)), start_time: "11:30", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 0, other_expenses: 0, amount_charged: 189, internal_notes: "Needs follow-up condensate clear.", customer_notes: null, assigned_technician_name: "Alex Rivera", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 12)) },
  { id: uid(16, "j"), customer_id: uid(5), title: "Emergency no-cooling", service_type: "Emergency no-cooling call", description: "Sunday call — frozen coil.", service_address_line1: "91 Folly Rd", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29412", scheduled_date: dateStr(addDays(monthStart, 13)), start_time: "16:00", estimated_duration_minutes: 150, status: "completed", labor_hours: 2.5, hourly_labor_rate: 165, material_cost: 55, other_expenses: 20, amount_charged: 720, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 13)) },
  { id: uid(17, "j"), customer_id: uid(6), title: "Downstairs filter + tune", service_type: "Filter replacement", description: "Filter change + airflow check.", service_address_line1: "33 Shem Creek Way", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: dateStr(addDays(monthStart, 14)), start_time: "10:00", estimated_duration_minutes: 60, status: "completed", labor_hours: 1, hourly_labor_rate: 125, material_cost: 28, other_expenses: 0, amount_charged: 165, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 14)) },
  { id: uid(18, "j"), customer_id: uid(7), title: "Walk-in cooler condenser", service_type: "Compressor replacement", description: "Cafe cooler struggling.", service_address_line1: "55 Market St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 15)), start_time: "07:00", estimated_duration_minutes: 360, status: "completed", labor_hours: 6, hourly_labor_rate: 125, material_cost: 1450, other_expenses: 75, amount_charged: 3250, internal_notes: "Special-order compressor.", customer_notes: "Keep cooler offline notice posted.", assigned_technician_name: "Alex Rivera", invoice_status: "partially_paid" as never, payment_status: "partial", completed_at: iso(addDays(monthStart, 15)) },
  { id: uid(19, "j"), customer_id: uid(8), title: "System installation consult", service_type: "System installation", description: "Quote visit for new 4-ton.", service_address_line1: "140 Isle of Palms Dr", service_address_line2: null, service_city: "Isle of Palms", service_state: "SC", service_postal_code: "29451", scheduled_date: dateStr(addDays(monthStart, 16)), start_time: "14:30", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 0, other_expenses: 15, amount_charged: 0, internal_notes: "Quoted $8,400 — awaiting decision.", customer_notes: null, assigned_technician_name: "Marcus Hale", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 16)) },
  { id: uid(20, "j"), customer_id: uid(9), title: "Condensate line clear", service_type: "AC diagnostic", description: "Secondary pan alarm.", service_address_line1: "6 Tradd St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 17)), start_time: "11:00", estimated_duration_minutes: 75, status: "completed", labor_hours: 1.25, hourly_labor_rate: 125, material_cost: 18, other_expenses: 0, amount_charged: 210, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 17)) },

  // Upcoming / other
  { id: uid(21, "j"), customer_id: uid(11), title: "Seasonal maintenance", service_type: "Seasonal maintenance", description: null, service_address_line1: "72 Ashley Ave", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29407", scheduled_date: dateStr(addDays(now, 1)), start_time: "09:00", estimated_duration_minutes: 90, status: "scheduled", labor_hours: 0, hourly_labor_rate: 125, material_cost: 35, other_expenses: 0, amount_charged: 249, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },
  { id: uid(22, "j"), customer_id: uid(3), title: "Draft estimate — new mini-split", service_type: "System installation", description: "Bedroom addition.", service_address_line1: "7 Battery Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: null, start_time: null, estimated_duration_minutes: 120, status: "draft", labor_hours: 0, hourly_labor_rate: 125, material_cost: 0, other_expenses: 0, amount_charged: 0, internal_notes: "Waiting on load calc.", customer_notes: null, assigned_technician_name: null, invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: null },
];

// Fix invoice_status typos - job 10 and 18 used wrong statuses
jobSeeds[9] = { ...jobSeeds[9], invoice_status: "sent" };
jobSeeds[17] = { ...jobSeeds[17], invoice_status: "sent" };

// Add more completed jobs to reach 17 this month
const extraCompleted: JobSeed[] = [
  { id: uid(23, "j"), customer_id: uid(10), title: "Vacant unit maintenance", service_type: "Seasonal maintenance", description: null, service_address_line1: "18 Sea Island Ln", service_address_line2: null, service_city: "Mount Pleasant", service_state: "SC", service_postal_code: "29464", scheduled_date: dateStr(addDays(monthStart, 1)), start_time: "10:00", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 40, other_expenses: 0, amount_charged: 275, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 1)) },
  { id: uid(24, "j"), customer_id: uid(12), title: "Bay 4 duct patch", service_type: "Duct repair", description: null, service_address_line1: "900 Remount Rd", service_address_line2: "Bldg C", service_city: "North Charleston", service_state: "SC", service_postal_code: "29406", scheduled_date: dateStr(addDays(monthStart, 18)), start_time: "13:00", estimated_duration_minutes: 120, status: "completed", labor_hours: 2, hourly_labor_rate: 125, material_cost: 70, other_expenses: 10, amount_charged: 480, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 18)) },
  { id: uid(25, "j"), customer_id: uid(2), title: "Pool house AC diagnostic", service_type: "AC diagnostic", description: null, service_address_line1: "45 Rutledge Ave", service_address_line2: "Pool house", service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(addDays(monthStart, 19)), start_time: "16:00", estimated_duration_minutes: 75, status: "completed", labor_hours: 1.25, hourly_labor_rate: 125, material_cost: 0, other_expenses: 0, amount_charged: 175, internal_notes: "Needs quote — missing costs intentionally for attention alert.", customer_notes: null, assigned_technician_name: "Alex Rivera", invoice_status: "not_invoiced", payment_status: "unpaid", completed_at: iso(addDays(monthStart, 19)) },
  { id: uid(26, "j"), customer_id: uid(5), title: "Filter replacement", service_type: "Filter replacement", description: null, service_address_line1: "91 Folly Rd", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29412", scheduled_date: dateStr(addDays(monthStart, 20)), start_time: "09:30", estimated_duration_minutes: 45, status: "completed", labor_hours: 0.75, hourly_labor_rate: 125, material_cost: 32, other_expenses: 0, amount_charged: 145, internal_notes: null, customer_notes: null, assigned_technician_name: "Sam Ortiz", invoice_status: "paid", payment_status: "paid", completed_at: iso(addDays(monthStart, 20)) },
  // Prior months for chart
  { id: uid(27, "j"), customer_id: uid(1), title: "Last month maintenance", service_type: "Seasonal maintenance", description: null, service_address_line1: "12 Magnolia St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29403", scheduled_date: dateStr(subDays(monthStart, 10)), start_time: "10:00", estimated_duration_minutes: 90, status: "completed", labor_hours: 1.5, hourly_labor_rate: 125, material_cost: 35, other_expenses: 0, amount_charged: 249, internal_notes: null, customer_notes: null, assigned_technician_name: "Alex Rivera", invoice_status: "paid", payment_status: "paid", completed_at: iso(subDays(monthStart, 10)) },
  { id: uid(28, "j"), customer_id: uid(4), title: "Two months ago install", service_type: "System installation", description: null, service_address_line1: "210 East Bay St", service_address_line2: null, service_city: "Charleston", service_state: "SC", service_postal_code: "29401", scheduled_date: dateStr(subMonths(monthStart, 1)), start_time: "08:00", estimated_duration_minutes: 480, status: "completed", labor_hours: 8, hourly_labor_rate: 125, material_cost: 3200, other_expenses: 150, amount_charged: 6200, internal_notes: null, customer_notes: null, assigned_technician_name: "Jordan Lee", invoice_status: "paid", payment_status: "paid", completed_at: iso(subMonths(monthStart, 1)) },
];

export const DEMO_JOBS: Job[] = [...jobSeeds, ...extraCompleted].map((j) => ({
  ...j,
  business_id: BUSINESS_ID,
  created_at: iso(subDays(now, 30)),
  updated_at: iso(now),
}));

function invoiceId(n: number) {
  return uid(n, "i");
}

export const DEMO_INVOICES: Invoice[] = [
  { id: invoiceId(1), business_id: BUSINESS_ID, customer_id: uid(2), job_id: uid(5, "j"), invoice_number: "CAH-1031", issue_date: dateStr(addDays(monthStart, 2)), due_date: dateStr(addDays(monthStart, 16)), status: "paid", subtotal: 2480, tax_rate: 0.07, tax_amount: 173.6, discount_amount: 0, total: 2653.6, amount_paid: 2653.6, notes: DEMO_BUSINESS.default_invoice_note, payment_token: "pay_demo_1031", stripe_payment_intent_id: "pi_demo_1031", paid_at: iso(addDays(monthStart, 5)), sent_at: iso(addDays(monthStart, 2)), viewed_at: iso(addDays(monthStart, 3)), created_at: iso(addDays(monthStart, 2)), updated_at: iso(now) },
  { id: invoiceId(2), business_id: BUSINESS_ID, customer_id: uid(3), job_id: uid(6, "j"), invoice_number: "CAH-1032", issue_date: dateStr(addDays(monthStart, 3)), due_date: dateStr(subDays(now, 5)), status: "overdue", subtotal: 690, tax_rate: 0.07, tax_amount: 48.3, discount_amount: 0, total: 738.3, amount_paid: 0, notes: DEMO_BUSINESS.default_invoice_note, payment_token: "pay_demo_1032", stripe_payment_intent_id: null, paid_at: null, sent_at: iso(addDays(monthStart, 3)), viewed_at: iso(addDays(monthStart, 4)), created_at: iso(addDays(monthStart, 3)), updated_at: iso(now) },
  { id: invoiceId(3), business_id: BUSINESS_ID, customer_id: uid(5), job_id: uid(7, "j"), invoice_number: "CAH-1033", issue_date: dateStr(addDays(monthStart, 4)), due_date: dateStr(addDays(monthStart, 18)), status: "paid", subtotal: 249, tax_rate: 0.07, tax_amount: 17.43, discount_amount: 0, total: 266.43, amount_paid: 266.43, notes: null, payment_token: "pay_demo_1033", stripe_payment_intent_id: "pi_demo_1033", paid_at: iso(addDays(monthStart, 6)), sent_at: iso(addDays(monthStart, 4)), viewed_at: null, created_at: iso(addDays(monthStart, 4)), updated_at: iso(now) },
  { id: invoiceId(4), business_id: BUSINESS_ID, customer_id: uid(9), job_id: uid(10, "j"), invoice_number: "CAH-1034", issue_date: dateStr(addDays(monthStart, 7)), due_date: dateStr(subDays(now, 8)), status: "overdue", subtotal: 780, tax_rate: 0.07, tax_amount: 54.6, discount_amount: 0, total: 834.6, amount_paid: 0, notes: null, payment_token: "pay_demo_1034", stripe_payment_intent_id: null, paid_at: null, sent_at: iso(addDays(monthStart, 7)), viewed_at: iso(addDays(monthStart, 9)), created_at: iso(addDays(monthStart, 7)), updated_at: iso(now) },
  { id: invoiceId(5), business_id: BUSINESS_ID, customer_id: uid(12), job_id: uid(12, "j"), invoice_number: "CAH-1035", issue_date: dateStr(addDays(monthStart, 9)), due_date: dateStr(addDays(now, 4)), status: "sent", subtotal: 890, tax_rate: 0.07, tax_amount: 62.3, discount_amount: 0, total: 952.3, amount_paid: 0, notes: "Net 14 — AP welcome.", payment_token: "pay_demo_1035", stripe_payment_intent_id: null, paid_at: null, sent_at: iso(addDays(monthStart, 9)), viewed_at: null, created_at: iso(addDays(monthStart, 9)), updated_at: iso(now) },
  { id: invoiceId(6), business_id: BUSINESS_ID, customer_id: uid(7), job_id: uid(18, "j"), invoice_number: "CAH-1036", issue_date: dateStr(addDays(monthStart, 15)), due_date: dateStr(addDays(monthStart, 29)), status: "partially_paid", subtotal: 3250, tax_rate: 0.07, tax_amount: 227.5, discount_amount: 100, total: 3377.5, amount_paid: 1500, notes: "Deposit applied.", payment_token: "pay_demo_1036", stripe_payment_intent_id: null, paid_at: null, sent_at: iso(addDays(monthStart, 15)), viewed_at: iso(addDays(monthStart, 16)), created_at: iso(addDays(monthStart, 15)), updated_at: iso(now) },
  { id: invoiceId(7), business_id: BUSINESS_ID, customer_id: uid(8), job_id: uid(9, "j"), invoice_number: "CAH-1037", issue_date: dateStr(addDays(monthStart, 6)), due_date: dateStr(addDays(monthStart, 20)), status: "paid", subtotal: 450, tax_rate: 0.07, tax_amount: 31.5, discount_amount: 0, total: 481.5, amount_paid: 481.5, notes: null, payment_token: "pay_demo_1037", stripe_payment_intent_id: "pi_demo_1037", paid_at: iso(addDays(monthStart, 8)), sent_at: iso(addDays(monthStart, 6)), viewed_at: null, created_at: iso(addDays(monthStart, 6)), updated_at: iso(now) },
  { id: invoiceId(8), business_id: BUSINESS_ID, customer_id: uid(11), job_id: uid(11, "j"), invoice_number: "CAH-1038", issue_date: dateStr(addDays(monthStart, 8)), due_date: dateStr(subDays(now, 2)), status: "overdue", subtotal: 420, tax_rate: 0.07, tax_amount: 29.4, discount_amount: 0, total: 449.4, amount_paid: 0, notes: null, payment_token: "pay_demo_1038", stripe_payment_intent_id: null, paid_at: null, sent_at: iso(addDays(monthStart, 8)), viewed_at: null, created_at: iso(addDays(monthStart, 8)), updated_at: iso(now) },
  { id: invoiceId(9), business_id: BUSINESS_ID, customer_id: uid(6), job_id: uid(8, "j"), invoice_number: "CAH-1039", issue_date: dateStr(addDays(monthStart, 5)), due_date: dateStr(addDays(monthStart, 19)), status: "paid", subtotal: 580, tax_rate: 0.07, tax_amount: 40.6, discount_amount: 0, total: 620.6, amount_paid: 620.6, notes: null, payment_token: "pay_demo_1039", stripe_payment_intent_id: "pi_demo_1039", paid_at: iso(addDays(monthStart, 7)), sent_at: iso(addDays(monthStart, 5)), viewed_at: iso(addDays(monthStart, 6)), created_at: iso(addDays(monthStart, 5)), updated_at: iso(now) },
  { id: invoiceId(10), business_id: BUSINESS_ID, customer_id: uid(1), job_id: uid(13, "j"), invoice_number: "CAH-1040", issue_date: dateStr(addDays(monthStart, 10)), due_date: dateStr(addDays(monthStart, 24)), status: "draft", subtotal: 245, tax_rate: 0.07, tax_amount: 17.15, discount_amount: 0, total: 262.15, amount_paid: 0, notes: null, payment_token: "pay_demo_1040", stripe_payment_intent_id: null, paid_at: null, sent_at: null, viewed_at: null, created_at: iso(addDays(monthStart, 10)), updated_at: iso(now) },
];

export const DEMO_INVOICE_ITEMS: InvoiceItem[] = DEMO_INVOICES.map((inv, idx) => ({
  id: uid(idx + 1, "ii"),
  business_id: BUSINESS_ID,
  invoice_id: inv.id,
  description: DEMO_JOBS.find((j) => j.id === inv.job_id)?.title ?? "HVAC service",
  quantity: 1,
  unit_price: inv.subtotal,
  amount: inv.subtotal,
  sort_order: 0,
  created_at: inv.created_at,
  updated_at: inv.updated_at,
}));

export const DEMO_PAYMENTS: Payment[] = [
  { id: uid(1, "p"), business_id: BUSINESS_ID, invoice_id: invoiceId(1), amount: 2653.6, method: "card", stripe_payment_id: "pi_demo_1031", paid_at: iso(addDays(monthStart, 5)), notes: null, created_at: iso(addDays(monthStart, 5)), updated_at: iso(now) },
  { id: uid(2, "p"), business_id: BUSINESS_ID, invoice_id: invoiceId(3), amount: 266.43, method: "card", stripe_payment_id: "pi_demo_1033", paid_at: iso(addDays(monthStart, 6)), notes: null, created_at: iso(addDays(monthStart, 6)), updated_at: iso(now) },
  { id: uid(3, "p"), business_id: BUSINESS_ID, invoice_id: invoiceId(6), amount: 1500, method: "manual", stripe_payment_id: null, paid_at: iso(addDays(monthStart, 16)), notes: "Partial deposit", created_at: iso(addDays(monthStart, 16)), updated_at: iso(now) },
  { id: uid(4, "p"), business_id: BUSINESS_ID, invoice_id: invoiceId(7), amount: 481.5, method: "card", stripe_payment_id: "pi_demo_1037", paid_at: iso(addDays(monthStart, 8)), notes: null, created_at: iso(addDays(monthStart, 8)), updated_at: iso(now) },
  { id: uid(5, "p"), business_id: BUSINESS_ID, invoice_id: invoiceId(9), amount: 620.6, method: "card", stripe_payment_id: "pi_demo_1039", paid_at: iso(addDays(monthStart, 7)), notes: null, created_at: iso(addDays(monthStart, 7)), updated_at: iso(now) },
];

export const DEMO_REMINDERS: Reminder[] = [
  { id: uid(1, "r"), business_id: BUSINESS_ID, invoice_id: invoiceId(2), kind: "on_due_date", status: "sent", scheduled_for: iso(subDays(now, 5)), sent_at: iso(subDays(now, 5)), created_at: iso(subDays(now, 6)), updated_at: iso(now) },
  { id: uid(2, "r"), business_id: BUSINESS_ID, invoice_id: invoiceId(2), kind: "days_3", status: "sent", scheduled_for: iso(subDays(now, 2)), sent_at: iso(subDays(now, 2)), created_at: iso(subDays(now, 5)), updated_at: iso(now) },
  { id: uid(3, "r"), business_id: BUSINESS_ID, invoice_id: invoiceId(4), kind: "days_7", status: "pending", scheduled_for: iso(addDays(now, 0)), sent_at: null, created_at: iso(subDays(now, 1)), updated_at: iso(now) },
];

export const DEMO_ACTIVITY: ActivityLog[] = [
  { id: uid(1, "a"), business_id: BUSINESS_ID, type: "payment_received", title: "Payment received", description: "CAH-1031 · $2,653.60", entity_type: "invoice", entity_id: invoiceId(1), metadata: null, created_at: iso(subDays(now, 1)), updated_at: iso(now) },
  { id: uid(2, "a"), business_id: BUSINESS_ID, type: "job_completed", title: "Job completed", description: "Bay 4 duct patch", entity_type: "job", entity_id: uid(24, "j"), metadata: null, created_at: iso(subDays(now, 1)), updated_at: iso(now) },
  { id: uid(3, "a"), business_id: BUSINESS_ID, type: "invoice_sent", title: "Invoice sent", description: "CAH-1035 to Nolan Storage", entity_type: "invoice", entity_id: invoiceId(5), metadata: null, created_at: iso(subDays(now, 2)), updated_at: iso(now) },
  { id: uid(4, "a"), business_id: BUSINESS_ID, type: "reminder_sent", title: "Reminder sent", description: "CAH-1032 · 3 days overdue", entity_type: "invoice", entity_id: invoiceId(2), metadata: null, created_at: iso(subDays(now, 2)), updated_at: iso(now) },
  { id: uid(5, "a"), business_id: BUSINESS_ID, type: "job_created", title: "Job scheduled", description: "Morning AC diagnostic · Elena Vargas", entity_type: "job", entity_id: uid(1, "j"), metadata: null, created_at: iso(subDays(now, 3)), updated_at: iso(now) },
  { id: uid(6, "a"), business_id: BUSINESS_ID, type: "customer_created", title: "Customer added", description: "Greg Nolan · Nolan Storage", entity_type: "customer", entity_id: uid(12), metadata: null, created_at: iso(subDays(now, 4)), updated_at: iso(now) },
  { id: uid(7, "a"), business_id: BUSINESS_ID, type: "invoice_marked_paid", title: "Marked paid", description: "CAH-1039", entity_type: "invoice", entity_id: invoiceId(9), metadata: null, created_at: iso(subDays(now, 5)), updated_at: iso(now) },
];

export const DEMO_MODE_COOKIE = "tf-mode";
export const DEMO_STORAGE_KEY = "tradeflow-demo-v1";
