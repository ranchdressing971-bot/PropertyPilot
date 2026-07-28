import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { NexusDashboard } from "@/components/nexus/NexusDashboard";
import { checkNexusAdmin } from "@/lib/nexus/admin";
import { loadNexusState } from "@/lib/nexus/state";

export const metadata: Metadata = {
  title: "Nexus — Atlas OS",
  description: "Internal outreach system.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const deniedCopy: Record<string, { title: string; body: string }> = {
  not_configured: {
    title: "Nexus is not configured",
    body: "Set NEXUS_ADMIN_EMAIL to your account email in .env.local and Vercel, then reload. Multiple operators can be separated by commas.",
  },
  not_signed_in: {
    title: "Sign in required",
    body: "Nexus is internal tooling. Sign in with the operator account to continue.",
  },
  not_admin: {
    title: "Not authorized",
    body: "This account is not in the configured Nexus operator list.",
  },
};

export default async function NexusPage() {
  const admin = await checkNexusAdmin();

  if (!admin.allowed) {
    const copy = deniedCopy[admin.reason ?? "not_admin"] ?? deniedCopy.not_admin!;
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5">
        <Card className="max-w-md text-center">
          <Logo size="md" href={undefined} className="justify-center" />
          <h1 className="mt-5 font-display text-xl font-semibold text-ink-900">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{copy.body}</p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Back to dashboard
          </Link>
        </Card>
      </main>
    );
  }

  const state = await loadNexusState();

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <Logo size="sm" href="/dashboard" />
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900">
              Nexus
            </h1>
            <p className="mt-1.5 text-sm text-ink-600">
              Find HOA managers → get their emails → write drafts → you approve
            </p>
          </div>
        </div>

        <div className="mt-7">
          <NexusDashboard initialState={state} />
        </div>
      </div>
    </main>
  );
}
