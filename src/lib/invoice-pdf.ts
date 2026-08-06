import { jsPDF } from "jspdf";
import type { Business, Customer, Invoice, InvoiceItem } from "./types";
import { formatMoneyExact } from "./profit";
import { formatDate } from "./format";

export function downloadInvoicePdf(input: {
  business: Business;
  customer: Customer | null | undefined;
  invoice: Invoice;
  items: InvoiceItem[];
}) {
  const { business, customer, invoice, items } = input;
  const doc = new jsPDF();
  const currency = business.currency;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(business.name, 20, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const bizLines = [
    business.address_line1,
    [business.city, business.state, business.postal_code].filter(Boolean).join(", "),
    business.phone,
    business.email,
  ].filter(Boolean) as string[];
  bizLines.forEach((line, i) => doc.text(line, 20, 32 + i * 5));

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", 140, 24);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoice_number, 140, 32);
  doc.text(`Issued ${formatDate(invoice.issue_date)}`, 140, 38);
  doc.text(`Due ${formatDate(invoice.due_date)}`, 140, 44);

  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 20, 60);
  doc.setFont("helvetica", "normal");
  const customerLines = [
    customer?.full_name,
    customer?.company_name,
    customer?.billing_address_line1,
    [customer?.billing_city, customer?.billing_state, customer?.billing_postal_code]
      .filter(Boolean)
      .join(", "),
    customer?.email,
  ].filter(Boolean) as string[];
  customerLines.forEach((line, i) => doc.text(line, 20, 68 + i * 5));

  let y = 100;
  doc.setFont("helvetica", "bold");
  doc.text("Description", 20, y);
  doc.text("Qty", 120, y);
  doc.text("Amount", 160, y);
  y += 6;
  doc.setDrawColor(220);
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  items.forEach((item) => {
    doc.text(item.description.slice(0, 55), 20, y);
    doc.text(String(item.quantity), 120, y);
    doc.text(formatMoneyExact(item.amount, currency), 160, y);
    y += 8;
  });

  y += 6;
  doc.line(120, y, 190, y);
  y += 8;
  const rows = [
    ["Subtotal", invoice.subtotal],
    ["Tax", invoice.tax_amount],
    ["Discount", -Number(invoice.discount_amount)],
    ["Total", invoice.total],
    ["Amount paid", invoice.amount_paid],
  ] as const;
  rows.forEach(([label, value]) => {
    doc.text(label, 120, y);
    doc.text(formatMoneyExact(Number(value), currency), 160, y);
    y += 7;
  });

  if (invoice.notes) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Notes", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(invoice.notes, 170);
    doc.text(split, 20, y);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
