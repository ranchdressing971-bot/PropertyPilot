import { jsPDF } from "jspdf";
import type { Violation } from "./mock-data";

export interface NoticePdfData {
  hoaName: string;
  managerName: string;
  propertyAddress: string;
  violation: Violation;
}

export function downloadViolationNoticePdf(data: NoticePdfData): void {
  const { hoaName, managerName, propertyAddress, violation } = data;
  const doc = new jsPDF();
  const dueDate = new Date(violation.detectedAt);
  dueDate.setDate(dueDate.getDate() + 14);

  let y = 20;
  const line = (text: string, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, 20, y);
    y += lines.length * (size * 0.45) + 4;
  };

  line(`${hoaName} HOA`, 10);
  line("VIOLATION NOTICE", 16, true);
  y += 4;
  line(`Notice #${violation.id.toUpperCase()}`, 10);
  line(`Date: ${new Date(violation.detectedAt).toLocaleDateString()}`, 10);
  y += 6;
  line("Property Address", 9, true);
  line(propertyAddress, 12, true);
  y += 4;
  line("Violation", 9, true);
  line(violation.type ?? "—", 12, true);
  line(violation.rule, 10);
  y += 4;
  line("Required Action", 9, true);
  line(
    "Please remedy the above violation within 14 days of this notice. Failure to comply may result in fines as outlined in the CC&Rs.",
    10
  );
  y += 4;
  line("Due Date", 9, true);
  line(
    dueDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    11,
    true
  );
  y += 8;
  line("Manager Signature", 9, true);
  line(managerName, 14);
  line(`HOA Community Manager, ${hoaName}`, 10);

  doc.save(`violation-notice-${violation.id}.pdf`);
}

export function downloadComplianceReportPdf(opts: {
  hoaName: string;
  complianceScore: number;
  inspectionCount: number;
  violationCount: number;
  topViolation: string;
}): void {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Compliance Report", 20, 25);
  doc.setFontSize(11);
  doc.text(opts.hoaName, 20, 35);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 42);
  doc.text(`Compliance score: ${opts.complianceScore}%`, 20, 58);
  doc.text(`Inspections on record: ${opts.inspectionCount}`, 20, 68);
  doc.text(`Open violations: ${opts.violationCount}`, 20, 78);
  doc.text(`Most common issue: ${opts.topViolation}`, 20, 88);
  doc.save(`compliance-report-${Date.now()}.pdf`);
}
