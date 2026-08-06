import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { Invoice, Reminder, ReminderKind } from "./types";

export const REMINDER_COPY: Record<ReminderKind, (invoiceNumber: string, amount: string) => string> = {
  on_due_date: (invoiceNumber, amount) =>
    `Friendly reminder: invoice ${invoiceNumber} for ${amount} is due today. Pay securely online when ready.`,
  days_3: (invoiceNumber, amount) =>
    `Invoice ${invoiceNumber} for ${amount} is 3 days past due. Please arrange payment at your earliest convenience.`,
  days_7: (invoiceNumber, amount) =>
    `Second notice: invoice ${invoiceNumber} for ${amount} is 7 days overdue. Reply if you need a copy of the invoice.`,
  days_14: (invoiceNumber, amount) =>
    `Final reminder: invoice ${invoiceNumber} for ${amount} is 14 days overdue. Contact us if payment has already been sent.`,
};

export function reminderKindForInvoice(
  invoice: Pick<Invoice, "due_date" | "status">,
  today = new Date()
): ReminderKind | null {
  if (!["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)) {
    return null;
  }
  const due = parseISO(`${invoice.due_date}T12:00:00`);
  const days = differenceInCalendarDays(today, due);
  if (days === 0) return "on_due_date";
  if (days === 3) return "days_3";
  if (days === 7) return "days_7";
  if (days === 14) return "days_14";
  return null;
}

export function buildReminderSchedule(invoice: Invoice, now = new Date()): Array<{
  kind: ReminderKind;
  scheduled_for: string;
}> {
  const due = parseISO(`${invoice.due_date}T09:00:00`);
  const schedule: Array<{ kind: ReminderKind; scheduled_for: string }> = [
    { kind: "on_due_date", scheduled_for: due.toISOString() },
    { kind: "days_3", scheduled_for: addDays(due, 3).toISOString() },
    { kind: "days_7", scheduled_for: addDays(due, 7).toISOString() },
    { kind: "days_14", scheduled_for: addDays(due, 14).toISOString() },
  ];
  return schedule.filter((r) => parseISO(r.scheduled_for) >= addDays(now, -1));
}

export function nextPendingReminders(
  invoices: Invoice[],
  existing: Reminder[],
  today = new Date()
): Array<{ invoice: Invoice; kind: ReminderKind; body: string }> {
  const out: Array<{ invoice: Invoice; kind: ReminderKind; body: string }> = [];
  for (const invoice of invoices) {
    const kind = reminderKindForInvoice(invoice, today);
    if (!kind) continue;
    const already = existing.some(
      (r) =>
        r.invoice_id === invoice.id &&
        r.kind === kind &&
        (r.status === "sent" || r.status === "pending")
    );
    if (already) continue;
    const remaining = Number(invoice.total) - Number(invoice.amount_paid);
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(remaining);
    out.push({
      invoice,
      kind,
      body: REMINDER_COPY[kind](invoice.invoice_number, amount),
    });
  }
  return out;
}
