"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NoticePreview } from "@/components/violations/NoticePreview";
import { Violation, getProperty } from "@/lib/mock-data";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  ArrowLeft,
  Brain,
  Sparkles,
  Loader2,
} from "lucide-react";

export function ViolationDetailView({ id }: { id: string }) {
  const [violation, setViolation] = useState<Violation | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/violation/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setViolation(data.violation);
        setAiPowered(data.aiPowered ?? false);
      })
      .catch(() => setViolation(null))
      .finally(() => setLoading(false));
  }, [id]);

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
        <div className="p-8 text-center text-slate-500">Violation not found.</div>
      </DashboardLayout>
    );
  }

  const property = getProperty(violation.propertyId);

  return (
    <DashboardLayout>
      <Header
        title={violation.type ?? "Violation"}
        subtitle={property?.address}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/dashboard/violations"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {aiPowered && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent-200/60 bg-accent-50/80 px-4 py-2.5 text-sm text-accent-800">
            <Sparkles className="h-4 w-4" />
            AI-generated analysis
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-5 sm:space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-500">Property</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {property?.address}
                  </p>
                </div>
                <Badge status={violation.status} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Detected Rule
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{violation.rule}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Confidence
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {violation.confidence}%
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
                      style={{ width: `${violation.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">
                Evidence Images
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(violation.evidenceImages.length
                  ? violation.evidenceImages
                  : property?.image
                    ? [property.image]
                    : []
                ).map((img, i) => (
                  <div
                    key={i}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200"
                  >
                    <Image src={img} alt={`Evidence ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  AI Reasoning
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {violation.reasoning}
              </p>
            </Card>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button className="flex-1 sm:flex-none">
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button variant="secondary" className="flex-1 sm:flex-none">
                <XCircle className="h-4 w-4" />
                Dismiss
              </Button>
              <Button variant="secondary" className="flex-1 sm:flex-none">
                <Edit3 className="h-4 w-4" />
                Edit Notice
              </Button>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Notice Preview
            </h3>
            <NoticePreview violation={violation} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
