import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm font-semibold text-brand-700">
        ← TradeFlow
      </Link>
      <h1 className="page-title mt-4">Privacy</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-600">
        TradeFlow stores business, customer, job, and invoice data you enter so you can
        run your HVAC company. Payment card details are processed by Stripe and are not
        stored on TradeFlow servers. Contact your account email for data requests.
      </p>
    </div>
  );
}
