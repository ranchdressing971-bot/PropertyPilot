import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata = {
  title: "Privacy Policy — RideBy",
};

export default function PrivacyPage() {
  return (
    <PublicLayout showNavActions={false}>
      <article className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-ink-500">Last updated: June 29, 2026</p>

        <h2>What we collect</h2>
        <p>
          RideBy collects account information (email, name, HOA name),
          property roster data you upload, inspection videos and AI analysis results,
          and usage data needed to operate the service.
        </p>

        <h2>How we use data</h2>
        <ul>
          <li>To run AI-powered HOA compliance inspections</li>
          <li>To generate violation notices and compliance reports</li>
          <li>To authenticate your account and secure your workspace</li>
        </ul>

        <h2>Third-party services</h2>
        <p>
          We use Supabase for authentication and data storage, OpenAI for vision
          analysis, Stripe for billing, Resend for email, and Vercel for hosting.
        </p>

        <h2>Data retention</h2>
        <p>
          Inspection data is retained while your account is active. You may request
          deletion by contacting support.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:privacy@propertypilot.app">privacy@propertypilot.app</a>
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
