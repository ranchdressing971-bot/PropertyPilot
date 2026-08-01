import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { NovaConsole } from "@/components/nova/NovaConsole";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Nova: Outreach Manager",
  description:
    "Nova runs RideBy outreach: warm, direct, and not afraid to push back.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const deniedCopy: Record<string, { title: string; body: string }> = {
  not_configured: {
    title: "Nova is not configured",
    body: "Set NEXUS_ADMIN_EMAIL to your account email in .env.local and Vercel, then reload.",
  },
  not_signed_in: {
    title: "Sign in required",
    body: "Nova is internal. Sign in with the operator account to continue.",
  },
  not_admin: {
    title: "Not authorized",
    body: "This account is not in the configured Nexus operator list.",
  },
};

type PageProps = {
  searchParams: Promise<{ listen?: string }>;
};

export default async function NovaPage({ searchParams }: PageProps) {
  const admin = await checkNexusAdmin();
  const sp = await searchParams;
  const autoListen = sp.listen === "1" || sp.listen === "true";

  if (!admin.allowed) {
    const copy = deniedCopy[admin.reason ?? "not_admin"] ?? deniedCopy.not_admin!;
    const next = autoListen ? "/nova?listen=1" : "/nova";
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5">
        <Card className="max-w-md text-center">
          <Logo size="md" href={undefined} className="justify-center" />
          <h1 className="mt-5 font-display text-xl font-semibold text-ink-900">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{copy.body}</p>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="mt-5 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Sign in
          </Link>
        </Card>
      </main>
    );
  }

  return <NovaConsole autoListen={autoListen} />;
}
