import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata = {
  title: "Terms of Service — RideBy",
};

const OPERATOR = "HG TAX AND ACCOUNTING SERVICES, CORP";

export default function TermsPage() {
  return (
    <PublicLayout showNavActions={false}>
      <article className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
        <h1>Terms of Service</h1>
        <p className="text-sm text-ink-500">Last updated: July 14, 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of{" "}
          <strong>RideBy</strong>, a software product operated by{" "}
          <strong>{OPERATOR}</strong> (&quot;we,&quot; &quot;us,&quot; or
          &quot;Operator&quot;). By creating an account or using RideBy, you agree
          to these Terms.
        </p>

        <h2>1. The service</h2>
        <p>
          RideBy provides AI-assisted tools for HOA and community managers to
          review drive-through inspection footage, match property addresses,
          flag possible compliance issues, and <strong>draft</strong> notices or
          reports for human review. RideBy does not automatically send
          enforcement notices to homeowners. You remain responsible for any
          message you choose to copy, send, or deliver.
        </p>

        <h2>2. Eligibility and authority</h2>
        <ul>
          <li>
            You must have legal authority (or written authorization) to inspect
            and manage the communities and properties you upload.
          </li>
          <li>
            You may not upload unlawful surveillance, non-consensual recordings,
            or content you do not have rights to process.
          </li>
          <li>
            Violation notices and enforcement actions must comply with your
            HOA&apos;s governing documents and applicable law.
          </li>
        </ul>

        <h2>3. Accounts and communities</h2>
        <p>
          You are responsible for your account credentials and for activity under
          your account. Free trials may be limited per community. Misrepresenting
          community identity to obtain additional free trials is prohibited.
        </p>

        <h2>4. AI disclaimer</h2>
        <p>
          AI detections, address matches, confidence scores, and drafted language
          are <strong>recommendations only</strong>, not legal determinations.
          {OPERATOR} and RideBy are not liable for enforcement actions, fines,
          disputes, or damages arising from reliance on AI output. Managers must
          verify addresses, evidence, and notice content before delivery.
        </p>

        <h2>5. Billing</h2>
        <p>
          Paid subscriptions are billed monthly based on the number of
          communities you select, using RideBy&apos;s published volume formula.
          See the <Link href="/pricing">pricing page</Link> for current rates.
          Fees are processed by Stripe. Unless required by law, fees are
          non-refundable once a billing period begins. You may cancel anytime;
          access continues through the end of the paid period.
        </p>

        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Abuse, reverse engineer, or overload the service</li>
          <li>Use RideBy to harass residents or violate privacy laws</li>
          <li>Resell access without our written permission</li>
          <li>Attempt to bypass trial, billing, or security limits</li>
        </ul>

        <h2>7. Intellectual property</h2>
        <p>
          RideBy software, branding, and related materials are owned by{" "}
          {OPERATOR} or its licensors. You keep ownership of videos, rosters, and
          content you upload; you grant us a limited license to process that
          content solely to provide the service.
        </p>

        <h2>8. Disclaimers and limitation of liability</h2>
        <p>
          RideBy is provided &quot;as is&quot; without warranties of any kind,
          including fitness for a particular purpose or uninterrupted
          availability. To the maximum extent permitted by law,{" "}
          {OPERATOR}&apos;s total liability arising from these Terms or RideBy
          shall not exceed the amounts you paid us for RideBy in the three (3)
          months before the claim.
        </p>

        <h2>9. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms or create
          risk to the service or others. You may stop using RideBy at any time.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update these Terms by posting a revised version on this page.
          Continued use after changes means you accept the updated Terms.
        </p>

        <h2>11. Contact</h2>
        <p>
          RideBy is operated by:
          <br />
          <strong>{OPERATOR}</strong>
          <br />
          For Terms questions, contact the Operator through the email associated
          with your RideBy account or the support channel listed on the site.
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
