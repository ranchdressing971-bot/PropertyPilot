"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ArrowRight, Home, Sparkles } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  const { profile } = useUserProfile();
  const hoaName = profile?.hoaName || "Your Community";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-lg px-5 py-12">
        <Card padding="lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50">
            <Sparkles className="h-6 w-6 text-accent-600" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">
            You&apos;re ready to scan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Upload a drive-through video of {hoaName}. AI will read house
            addresses from mailboxes, signs, and curbs — no spreadsheet needed.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-600">
            <li className="flex items-start gap-2">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              Drive slowly past each home
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              AI finds addresses and checks for violations
            </li>
          </ul>
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
      </div>
    </DashboardLayout>
  );
}
