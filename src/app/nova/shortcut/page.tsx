import type { Metadata } from "next";
import Link from "next/link";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { getAppUrl } from "@/lib/stripe";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Hey Nova · iOS Shortcut",
  description:
    "Glasses recipe: Siri SpeakText first, then open Nova — Safari cannot greet over Bluetooth mic.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NovaShortcutPage() {
  const admin = await checkNexusAdmin();
  const appUrl = (getAppUrl() || "https://rideby-ai.vercel.app").replace(
    /\/$/,
    ""
  );
  const listenWithQExample = `${appUrl}/nova?listen=1&q=`;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#05030a] px-5 py-10 text-white">
      <div className="w-full max-w-md">
        <p className="text-center text-[11px] tracking-[0.04em] text-white/40">
          <RideByWordmark variant="light" className="text-sm text-white/55" />
        </p>
        <h1 className="mt-3 text-center font-display text-3xl font-semibold tracking-[0.14em]">
          HEY NOVA
        </h1>
        <p className="mt-4 text-center text-base font-medium leading-snug text-white/80">
          Safari can&apos;t talk over an open glasses mic — Siri speaks first,
          then Nova opens.
        </p>

        <div className="mt-8 space-y-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
            Glasses shortcut — 3 steps
          </p>

          <ol className="space-y-5">
            <li className="rounded-2xl border border-cyan-300/25 bg-white/[0.05] px-4 py-4">
              <p className="text-lg font-bold tracking-tight text-white">
                1. Speak Text
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                First action. Text exactly{" "}
                <span className="font-semibold text-white">
                  whats up big dog
                </span>{" "}
                (no comma). This is the only greeting — Nova will not say it in
                the browser.
              </p>
            </li>

            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-lg font-bold tracking-tight text-white">
                2. Dictate Text
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Speak your command after the greeting. (Or Ask for Input → Input
                Type → Dictate.)
              </p>
            </li>

            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-lg font-bold tracking-tight text-white">
                3. Open URLs
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                URL — insert the DictateText result after{" "}
                <span className="font-mono text-white/80">q=</span>:
              </p>
              <code className="mt-2.5 block break-all rounded-lg bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cyan-100/90">
                {listenWithQExample}
                <span className="text-amber-100/85">DictatedText</span>
              </code>
              <p className="mt-2 text-xs text-white/45">
                Rename the shortcut{" "}
                <span className="text-white/70">Hey Nova</span> → assign to your
                Siri / glasses button.
              </p>
            </li>
          </ol>

          <div className="space-y-2 text-xs leading-relaxed text-white/45">
            <p>
              Stay signed in to the operator account in Safari. Allow Microphone
              once so follow-up listen works without a tap.
            </p>
            <p>
              First-time: open Nova in Safari, grant mic, stay signed in. Prefer
              Safari (not Private).
            </p>
          </div>

          <a
            href="shortcuts://run-shortcut?name=Hey%20Nova"
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium tracking-wide text-white/80 transition hover:bg-white/10"
          >
            Run Hey Nova
          </a>
        </div>

        {!admin.allowed && (
          <p className="mt-6 text-center text-sm text-amber-200/90">
            Sign in with an operator account before testing the shortcut.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs">
          <Link
            href="/nova?listen=1"
            className="text-cyan-200/70 hover:text-white"
          >
            Open Nova listening
          </Link>
          <Link href="/nova" className="text-white/40 hover:text-white/70">
            Nova console
          </Link>
          <Link href="/nexus" className="text-white/40 hover:text-white/70">
            Nexus
          </Link>
        </div>
      </div>
    </main>
  );
}
