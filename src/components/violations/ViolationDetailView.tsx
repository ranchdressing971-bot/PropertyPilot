"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NoticePreview } from "@/components/violations/NoticePreview";
import { Violation } from "@/lib/mock-data";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Brain,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { ErrorState } from "@/components/ui/ErrorState";

export function ViolationDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const [violation, setViolation] = useState<Violation | null>(null);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/violation/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setViolation(data.violation);
        setPropertyAddress(data.propertyAddress ?? null);
        setAiPowered(data.aiPowered ?? false);
      })
      .catch(() => setViolation(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status: "approved" | "dismissed") {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/violation/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setViolation(data.violation);
        toast(
          status === "approved" ? "Violation approved" : "Violation dismissed"
        );
      } else {
        toast(data.error ?? "Could not update violation", "error");
      }
    } catch {
      toast("Could not update violation", "error");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Header title="Loading..." />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!violation) {
    return (
      <DashboardLayout>
        <Header title="Not Found" />
        <PageContent>
          <ErrorState
            title="Violation not found"
            message="This flag may have been removed or you don't have access."
            actionLabel="Back to violations"
            actionHref="/dashboard/violations"
          />
        </PageContent>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Header
        title={violation.type ?? "Violation"}
        subtitle={propertyAddress ?? undefined}
      />
      <PageContent>
        <Link
          href="/dashboard/violations"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to violations
        </Link>

        {aiPowered && (
          <div className="flex items-start gap-3 rounded-xl border border-accent-200/60 bg-accent-50/80 p-4 text-sm text-accent-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            AI-generated analysis
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-ink-500">Property</p>
                  <p className="text-lg font-semibold text-ink-900">
                    {propertyAddress ?? "Unknown address"}
                  </p>
                </div>
                <Badge status={violation.status} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-ink-400">
                    Detected Rule
                  </p>
                  <p className="mt-1 text-sm text-ink-700">{violation.rule}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-ink-400">
                    Confidence
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink-900">
                    {violation.confidence}%
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
                      style={{ width: `${violation.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {violation.evidenceImages.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-ink-900">
                  Evidence Images
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {violation.evidenceImages.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-[4/3] overflow-hidden rounded-xl border border-ink-200"
                    >
                      <Image src={img} alt={`Evidence ${i + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent-600" />
                <h3 className="text-sm font-semibold text-ink-900">
                  AI Reasoning
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {violation.reasoning}
              </p>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                className="w-full"
                disabled={actionLoading || violation.status === "approved"}
                onClick={() => updateStatus("approved")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={actionLoading || violation.status === "dismissed"}
                onClick={() => updateStatus("dismissed")}
              >
                <XCircle className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Notice Preview
            </h3>
            <NoticePreview
              violation={violation}
              propertyAddress={propertyAddress ?? "Unknown address"}
            />
          </div>
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
