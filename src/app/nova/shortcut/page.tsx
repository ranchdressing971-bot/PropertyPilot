import type { Metadata } from "next";
import Link from "next/link";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { getAppUrl } from "@/lib/stripe";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Hey Nova · iOS Shortcut",
  description:
    "SpeakText says whats up big dog first — the webpage cannot talk first on iPhone.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NovaShortcutPage() {
  const admin = await checkNexusAdmin();
  const appUrl = (getAppUrl() || "https://rideby-ai.vercel.app").replace(
    /\/$/,
    ""
  );
  const listenUrl = `${appUrl}/nova?listen=1`;
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
        <p className="mt-4 text-center text-base font-medium leading-snug text-white/85">
          This is what makes her talk — the webpage cannot talk first on
          iPhone.
        </p>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/50">
          Safari blocks page audio until you tap. Siri Shortcut{" "}
          <span className="text-white/70">Speak Text</span> is allowed to speak
          immediately. Put it first.
        </p>

        <div className="mt-8 space-y-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
            iPhone shortcut — hear her first
          </p>

          <ol className="space-y-5">
            <li className="rounded-2xl border border-cyan-300/35 bg-cyan-300/[0.07] px-4 py-5">
              <p className="text-xl font-bold tracking-tight text-white">
                1. Speak Text ← required, first
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Open{" "}
                <a
                  href="shortcuts://"
                  className="text-cyan-200/90 underline decoration-cyan-200/30 underline-offset-2"
                >
                  Shortcuts
                </a>{" "}
                → new shortcut → add{" "}
                <span className="font-semibold text-white">Speak Text</span>.
                Text exactly:
              </p>
              <p className="mt-3 rounded-lg bg-black/45 px-3 py-3 text-center text-lg font-semibold tracking-wide text-white">
                whats up big dog
              </p>
              <p className="mt-2 text-xs text-white/45">
                No comma. This is the greeting you hear — Nova will not autoplay
                it in Safari.
              </p>
            </li>

            <li className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-lg font-bold tracking-tight text-white">
                2. Open URLs
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                After SpeakText finishes, open Nova listening:
              </p>
              <code className="mt-2.5 block break-all rounded-lg bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cyan-100/90">
                {listenUrl}
              </code>
              <p className="mt-2 text-xs text-white/45">
                Rename the shortcut{" "}
                <span className="text-white/70">Hey Nova</span> → Done. Run it
                from Shortcuts or Siri.
              </p>
            </li>
          </ol>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Optional — dictate a command
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Between SpeakText and Open URLs, add{" "}
              <span className="text-white/75">Dictate Text</span>, then open:
            </p>
            <code className="mt-2.5 block break-all rounded-lg bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cyan-100/90">
              {listenWithQExample}
              <span className="text-amber-100/85">DictatedText</span>
            </code>
            <p className="mt-2 text-xs text-white/40">
              Insert the DictateText variable after{" "}
              <span className="font-mono text-white/60">q=</span>.
            </p>
          </div>

          <div className="space-y-2 text-xs leading-relaxed text-white/45">
            <p>
              First time: open Nova in Safari, grant Microphone, stay signed in
              (not Private).
            </p>
            <p>
              Without the Shortcut: open{" "}
              <span className="font-mono text-white/60">/nova</span> and tap the
              orb once — that unlocks sound and can greet in-page.
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
