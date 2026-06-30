"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RosterImport } from "@/components/properties/RosterImport";
import { useRoster } from "@/hooks/useRoster";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CheckCircle2, ArrowRight, Home } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  const { profile } = useUserProfile();
  const { properties, importCsv } = useRoster();
  const [step, setStep] = useState(properties.length > 0 ? 2 : 1);

  const hoaName = profile?.hoaName || "Your Community";

  async function handleImport(csv: string) {
    await importCsv(csv, hoaName);
    setStep(2);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="mb-8 flex items-center gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= s
                  ? "bg-ink-900 text-white"
                  : "bg-ink-100 text-ink-400"
              }`}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-900">
              Import your property roster
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Add the homes in {hoaName} so AI can match inspections to real addresses.
              You can skip and use sample data for now.
            </p>
            <div className="mt-6">
              <RosterImport neighborhood={hoaName} onImport={handleImport} />
            </div>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setStep(2)}
            >
              Skip for now
            </Button>
          </>
        )}

        {step === 2 && (
          <Card padding="lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <Home className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">
              You&apos;re ready to scan
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              {properties.length > 0
                ? `${properties.length} properties in your roster. Upload a drive-through video to run your first AI inspection.`
                : "Upload a drive-through video to run your first AI inspection. Import a roster anytime from Properties."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/inspections/upload">
                <Button>
                  Upload first inspection
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary">Go to dashboard</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
