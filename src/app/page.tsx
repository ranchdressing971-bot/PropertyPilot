import Link from "next/link";
import { DemoEnterButton } from "@/components/marketing/DemoEnterButton";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(26,32,28,0.12) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-950">
          TradeFlow
        </span>
        <Link href="/login" className="text-sm font-semibold text-ink-600 hover:text-ink-950">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-5xl flex-col justify-center px-5 pb-20 pt-6">
        <p className="section-label">HVAC operations</p>
        <h1 className="mt-3 font-display text-[clamp(3.25rem,12vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-ink-950">
          TradeFlow
        </h1>
        <p className="mt-6 max-w-md text-lg font-medium leading-snug text-ink-700 sm:text-xl">
          Know what got done, who owes you, and what each job made.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
          Customers, jobs, invoices, and profit — built for owners who still answer the phone.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <DemoEnterButton />
          <Link href="/signup" className="btn-secondary px-5 py-3">
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}
