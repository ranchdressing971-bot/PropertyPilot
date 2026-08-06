import Link from "next/link";
import { DemoEnterButton } from "@/components/marketing/DemoEnterButton";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh bg-[#f3f4f2]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-950">
          TradeFlow
        </span>
        <Link href="/login" className="text-sm font-semibold text-ink-600 hover:text-ink-950">
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-5xl flex-col justify-center px-5 pb-20 pt-6">
        <h1 className="font-display text-[clamp(2.75rem,10vw,5.5rem)] font-semibold leading-[1.05] tracking-tight text-ink-950">
          TradeFlow
        </h1>
        <p className="mt-5 max-w-md text-lg font-medium leading-snug text-ink-700 sm:text-xl">
          Know what got done, who owes you, and what each job made.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
          Customers, jobs, invoices, and profit for small HVAC companies.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <DemoEnterButton />
          <Link href="/signup" className="btn-secondary px-5 py-3">
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
