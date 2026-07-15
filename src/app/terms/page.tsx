import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata = {
  title: "Terms of Service — RideBy",
};

export default function TermsPage() {
  return (
    <PublicLayout showNavActions={false}>
      <article className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
        <h1>Terms of Service</h1>
        <p className="text-sm text-ink-500">Last updated: June 29, 2026</p>

        <h2>Service description</h2>
        <p>
          RideBy provides AI-assisted tools for HOA community managers to
          review drive-through inspection footage and draft compliance notices.
          AI outputs require human review before sending to homeowners.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>You must have authority to inspect and manage the properties in your roster</li>
          <li>You may not upload unlawful surveillance or non-consensual recordings</li>
          <li>Violation notices must comply with your HOA&apos;s governing documents and local law</li>
        </ul>

        <h2>AI disclaimer</h2>
        <p>
          AI detections are recommendations, not legal determinations. RideBy
          is not liable for enforcement actions taken based on AI output. Managers
          are responsible for verifying all notices before delivery.
        </p>

        <h2>Billing</h2>
        <p>
          Paid plans are billed monthly by community count using RideBy&apos;s
          volume formula. See our{" "}
          <Link href="/pricing">pricing page</Link> for current rates.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:legal@propertypilot.app">legal@propertypilot.app</a>
        </p>

        <p className="mt-8 not-prose">
          <Link href="/" className="text-copper-700 hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </PublicLayout>
  );
}
