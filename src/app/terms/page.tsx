import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm font-semibold text-brand-700">
        ← TradeFlow
      </Link>
      <h1 className="page-title mt-4">Terms</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-600">
        TradeFlow is provided for managing HVAC field operations. You are responsible for
        the accuracy of customer, job, and invoice data you enter. Demo mode uses sample
        data for evaluation only.
      </p>
    </div>
  );
}
