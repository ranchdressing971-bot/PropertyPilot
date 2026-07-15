import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata = {
  title: "Privacy Policy — RideBy",
};

const OPERATOR = "HG TAX AND ACCOUNTING SERVICES, CORP";

export default function PrivacyPage() {
  return (
    <PublicLayout showNavActions={false}>
      <article className="mx-auto max-w-3xl px-5 py-12 prose prose-slate">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-ink-500">Last updated: July 14, 2026</p>

        <p>
          This Privacy Policy describes how <strong>RideBy</strong>, operated by{" "}
          <strong>{OPERATOR}</strong> (&quot;we,&quot; &quot;us,&quot; or
          &quot;Operator&quot;), collects, uses, and shares information when you
          use the RideBy service.
        </p>

        <h2>1. Who we are</h2>
        <p>
          RideBy is a product of {OPERATOR}. This policy applies to the RideBy
          website and application.
        </p>

        <h2>2. What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — email, name, HOA / community name,
            and profile settings you provide
          </li>
          <li>
            <strong>Community data</strong> — property rosters and related
            metadata you import
          </li>
          <li>
            <strong>Inspection data</strong> — videos or frames you upload, AI
            analysis results, evidence images, and review decisions
          </li>
          <li>
            <strong>Billing data</strong> — subscription status and community
            count; payment card details are processed by Stripe (we do not store
            full card numbers)
          </li>
          <li>
            <strong>Usage data</strong> — logs needed to operate, secure, and
            improve the service
          </li>
        </ul>

        <h2>3. How we use data</h2>
        <ul>
          <li>To provide AI-assisted HOA inspection workflows</li>
          <li>To draft notices and reports for your review (you send them)</li>
          <li>To authenticate accounts and prevent abuse</li>
          <li>To process subscriptions and customer support</li>
        </ul>

        <h2>4. Drafted emails and notices</h2>
        <p>
          RideBy may help you <strong>draft</strong> violation notices or
          reports. Unless you separately enable and configure outbound email
          delivery, we do not send those messages to homeowners for you. Copying
          and sending is your responsibility.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          We use service providers such as Supabase (auth and storage), OpenAI
          (vision analysis), Stripe (billing), Vercel (hosting), and optionally
          an email provider if outbound notice delivery is enabled. They process
          data only as needed to provide their services.
        </p>

        <h2>6. Retention</h2>
        <p>
          We retain account and inspection data while your account is active and
          as needed for legal, security, and billing purposes. You may request
          deletion of your account data by contacting the Operator.
        </p>

        <h2>7. Security</h2>
        <p>
          We use reasonable administrative and technical safeguards. No method of
          transmission or storage is 100% secure.
        </p>

        <h2>8. Children</h2>
        <p>
          RideBy is intended for business use by adults operating HOA or property
          management workflows, not for children under 13.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this policy by posting a revised version on this page.
          Continued use after changes means you accept the updated policy.
        </p>

        <h2>10. Contact</h2>
        <p>
          Privacy questions for RideBy:
          <br />
          <strong>{OPERATOR}</strong>
          <br />
          Contact the Operator through the email on your RideBy account or the
          support channel listed on the site.
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
