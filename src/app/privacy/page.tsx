import Link from "next/link";
import { HomeLogo } from "@/components/brand/HomeLogo";

export const metadata = {
  title: "Privacy Policy — Property Pilot",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas dark:bg-ink-950">
      <nav className="border-b border-ink-200/80 px-5 py-4 dark:border-ink-800">
        <HomeLogo size="sm" href="/" />
      </nav>
      <article className="mx-auto max-w-3xl px-5 py-12 prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-ink-500">Last updated: June 29, 2026</p>

        <h2>What we collect</h2>
        <p>
          Property Pilot collects account information (email, name, HOA name),
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
          analysis, and Vercel for hosting. Video and image data sent for analysis
          is processed according to each provider&apos;s terms.
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

        <p className="mt-8">
          <Link href="/" className="text-accent-600 hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
