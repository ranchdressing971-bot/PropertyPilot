"use client";

import Image from "next/image";
import { Violation } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download, Mail, CheckCircle2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { displayHoaName, displayManagerName } from "@/lib/profile";
import { downloadViolationNoticePdf } from "@/lib/pdf-notice";

interface NoticePreviewProps {
  violation: Violation;
  propertyAddress: string;
  onApprove?: () => void;
}

export function NoticePreview({
  violation,
  propertyAddress,
  onApprove,
}: NoticePreviewProps) {
  const { profile, isDemo } = useUserProfile();

  const hoaLabel = displayHoaName(profile, isDemo);
  const managerName = displayManagerName(profile, isDemo);

  const dueDate = new Date(violation.detectedAt);
  dueDate.setDate(dueDate.getDate() + 14);

  function handleDownloadPdf() {
    downloadViolationNoticePdf({
      hoaName: hoaLabel,
      managerName,
      propertyAddress,
      violation,
    });
  }

  function handleEmailOwner() {
    const subject = encodeURIComponent(
      `${hoaLabel} HOA — Violation Notice (${propertyAddress})`
    );
    const body = encodeURIComponent(
      `Dear Homeowner,\n\nPlease review the attached violation notice for ${propertyAddress}.\n\nViolation: ${violation.type}\n${violation.rule}\n\nPlease remedy within 14 days.\n\n${managerName}\n${hoaLabel} HOA`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <Card className="border-slate-300">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {hoaLabel} HOA
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Violation Notice
            </h3>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Notice #{violation.id.toUpperCase()}</p>
            <p>{new Date(violation.detectedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">
            Property Address
          </p>
          <p className="mt-1 font-semibold text-slate-900">{propertyAddress}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-slate-400">
            Inspection Date
          </p>
          <p className="mt-1 text-slate-700">
            {new Date(violation.detectedAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-slate-400">
            Violation
          </p>
          <p className="mt-1 font-semibold text-red-700">{violation.type}</p>
          <p className="mt-1 text-slate-600">{violation.rule}</p>
        </div>

        {violation.evidenceImages.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">
              Evidence
            </p>
            <div className="mt-2 flex gap-2">
              {violation.evidenceImages.map((img, i) => (
                <div
                  key={i}
                  className="relative h-24 w-32 overflow-hidden rounded-lg border border-slate-200"
                >
                  <Image src={img} alt={`Evidence ${i + 1}`} fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase text-slate-400">
            Required Action
          </p>
          <p className="mt-1 text-slate-700">
            Please remedy the above violation within 14 days of this notice.
            Failure to comply may result in fines as outlined in the CC&Rs.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-slate-400">
            Due Date
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {dueDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Manager Signature
          </p>
          <p className="mt-2 font-serif text-lg italic text-slate-700">
            {managerName}
          </p>
          <p className="text-xs text-slate-500">
            HOA Community Manager, {hoaLabel}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        {onApprove && (
          <Button size="sm" onClick={onApprove}>
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={handleEmailOwner}>
          <Mail className="h-4 w-4" />
          Email Owner
        </Button>
      </div>
    </Card>
  );
}
