import { NextResponse } from "next/server";
import { Resend } from "resend";
import { nextPendingReminders } from "@/lib/reminders";
import type { Invoice, Reminder } from "@/lib/types";

/**
 * Generates due reminders for open invoices.
 * Body may include invoices/reminders/remindersEnabled for demo/testing.
 * When Resend is configured, sends email; otherwise returns generated copy.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const remindersEnabled = body.remindersEnabled !== false;
    if (!remindersEnabled) {
      return NextResponse.json({
        generated: 0,
        sent: 0,
        message: "Reminders are disabled for this business.",
      });
    }

    const invoices = (body.invoices ?? []) as Invoice[];
    const existing = (body.reminders ?? []) as Reminder[];
    const pending = nextPendingReminders(invoices, existing);

    let sent = 0;
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();

    if (apiKey && from && pending.length) {
      const resend = new Resend(apiKey);
      for (const item of pending) {
        const to = body.customerEmails?.[item.invoice.customer_id];
        if (!to) continue;
        await resend.emails.send({
          from,
          to,
          subject: `Payment reminder · ${item.invoice.invoice_number}`,
          text: item.body,
        });
        sent += 1;
      }
    }

    return NextResponse.json({
      generated: pending.length,
      sent,
      reminders: pending.map((p) => ({
        invoiceId: p.invoice.id,
        invoiceNumber: p.invoice.invoice_number,
        kind: p.kind,
        body: p.body,
      })),
    });
  } catch (error) {
    console.error("reminders/run", error);
    return NextResponse.json({ error: "Failed to generate reminders" }, { status: 500 });
  }
}
