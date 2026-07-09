"use client";

import { useState } from "react";
import { Violation } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MediaImage } from "@/components/ui/MediaImage";
import { Download, Mail, CheckCircle2, Loader2 } from "lucide-react";
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
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

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

  function handleMailto() {
    const subject = encodeURIComponent(
      `${hoaLabel} HOA — Violation Notice (${propertyAddress})`
    );
    const body = encodeURIComponent(
      `Dear Homeowner,\n\nPlease review the violation notice for ${propertyAddress}.\n\nViolation: ${violation.type}\n${violation.rule}\n\nPlease remedy within 14 days.\n\n${managerName}\n${hoaLabel} HOA`
    );
    window.location.href = `mailto:${emailTo || ""}?subject=${subject}&body=${body}`;
  }

  async function handleSendEmail() {
    if (!emailTo) {
      setEmailMsg("Enter the owner email address.");
      return;
    }
    setSending(true);
    setEmailMsg(null);
    try {
      const res = await fetch("/api/email/violation-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          propertyAddress,
          violationType: violation.type,
          violationDescription: violation.rule,
          hoaName: hoaLabel,
          managerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          handleMailto();
          return;
        }
        throw new Error(data.error ?? "Send failed");
      }
      setEmailMsg("Notice sent.");
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-ink-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
              {hoaLabel} HOA
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">
              Violation Notice
            </h3>
          </div>
          <div className="text-right text-xs text-ink-500">
            <p>Notice #{violation.id.toUpperCase()}</p>
            <p>{new Date(violation.detectedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-ink-400">Property Address</p>
          <p className="mt-1 font-semibold text-ink-900">{propertyAddress}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-ink-400">Violation</p>
          <p className="mt-1 font-semibold text-red-700">{violation.type}</p>
          <p className="mt-1 text-ink-600">{violation.rule}</p>
        </div>

        {violation.evidenceImages.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase text-ink-400">Evidence</p>
            <div className="mt-2 flex gap-2">
              {violation.evidenceImages.map((img, i) => (
                <div
                  key={i}
                  className="relative h-24 w-32 overflow-hidden rounded-lg border border-ink-200"
                >
                  <MediaImage
                    src={img}
                    alt={`Evidence ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase text-ink-400">Due Date</p>
          <p className="mt-1 font-semibold text-ink-900">
            {dueDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="border-t border-ink-200 pt-4">
          <p className="text-xs font-medium uppercase text-ink-400">Manager</p>
          <p className="mt-2 font-serif text-lg italic text-ink-700">{managerName}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-ink-200 pt-4">
        <div>
          <label className="text-xs font-medium text-ink-500">Owner email</label>
          <Input
            type="email"
            placeholder="owner@email.com"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            className="mt-1"
          />
        </div>
        {emailMsg && <p className="text-xs text-ink-500">{emailMsg}</p>}
        <div className="flex flex-wrap gap-3">
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
          <Button variant="secondary" size="sm" onClick={handleSendEmail} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email owner
          </Button>
        </div>
      </div>
    </Card>
  );
}
