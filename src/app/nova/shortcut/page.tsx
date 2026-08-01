import type { Metadata } from "next";
import Link from "next/link";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { getAppUrl } from "@/lib/stripe";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Hey Nova · iOS Shortcut",
  description:
    "Set up the Hey Nova Siri Shortcut for Bluetooth glasses and iPhone — no in-page tap.",
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
  const goUrl = `${appUrl}/nova/go`;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#05030a] px-5 py-10 text-white">
      <div className="w-full max-w-md">
        <p className="text-center text-[11px] tracking-[0.04em] text-white/40">
          <RideByWordmark variant="light" className="text-sm text-white/55" />
        </p>
        <h1 className="mt-3 text-center font-display text-3xl font-semibold tracking-[0.14em]">
          HEY NOVA
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-white/55">
          Bluetooth glasses + Siri button: the Shortcut is your gesture. No
          in-page tap required after setup.
        </p>

        <div className="mt-7 rounded-2xl border border-cyan-300/20 bg-white/[0.04] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/55">
            Open URL base
          </p>
          <p className="mt-2 break-all font-mono text-sm text-cyan-100/90">
            {listenWithQExample}
            <span className="text-white/45">[Dictated Text]</span>
          </p>
          <p className="mt-2 text-xs text-white/40">
            Mic-only fallback (no dictation):{" "}
            <span className="font-mono text-white/55">{listenUrl}</span>
            {" · "}
            <span className="font-mono text-white/55">{goUrl}</span>
          </p>
        </div>

        <div className="mt-8 space-y-5 text-left text-xs leading-relaxed text-white/50">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
              Glasses / no-tap Shortcut (recommended)
            </p>
            <ol className="space-y-2.5">
              <li>
                1. Open the{" "}
                <a
                  href="shortcuts://"
                  className="text-cyan-200/80 underline decoration-cyan-200/30 underline-offset-2"
                >
                  Shortcuts
                </a>{" "}
                app → <span className="text-white/75">+</span> new shortcut.
              </li>
              <li>
                2. Add action:{" "}
                <span className="text-white/75">Speak Text</span> → text exactly{" "}
                <span className="text-white/80">whats up big dog</span> (no
                comma). This is Nova&apos;s greeting from the glasses.
              </li>
              <li>
                3. Add action:{" "}
                <span className="text-white/75">Dictate Text</span> (or{" "}
                <span className="text-white/75">Ask for Input</span> with Input
                Type → Dictate). Speak your command after the greeting.
              </li>
              <li>
                4. Optional:{" "}
                <span className="text-white/75">Set variable</span> named{" "}
                <span className="text-white/80">Dictation</span> from that
                result (makes the next step clearer).
              </li>
              <li>
                5. Add action:{" "}
                <span className="text-white/75">Open URLs</span>. URL:
                <code className="mt-1.5 block rounded-lg bg-white/5 px-2.5 py-2 font-mono text-[11px] text-cyan-100/85">
                  {listenWithQExample}
                  <span className="text-amber-100/80">Dictated Text</span>
                </code>
                Insert the Dictate Text / Dictation variable after{" "}
                <span className="font-mono text-white/70">q=</span>. Shortcuts
                URL-encodes the variable when you insert it into the URL field.
              </li>
              <li>
                6. Rename the shortcut to{" "}
                <span className="text-white/80">Hey Nova</span> exactly → Done.
                Assign it to the Siri / glasses button if you use that.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
              What happens
            </p>
            <ol className="space-y-2.5">
              <li>
                1. Press the glasses / Siri button and run{" "}
                <span className="text-white/80">Hey Nova</span>.
              </li>
              <li>
                2. Siri speaks <span className="text-white/80">whats up big
                dog</span>, then captures your command via Dictate Text.
              </li>
              <li>
                3. Safari opens Nova with{" "}
                <span className="font-mono text-white/70">listen=1</span> and{" "}
                <span className="font-mono text-white/70">q=</span> your
                utterance. Nova processes that turn immediately, then resumes
                listening for follow-ups (no page tap).
              </li>
              <li>
                4. Stay signed in to the operator account in Safari so the
                Shortcut skips the login wall.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
              After you create it
            </p>
            <p>
              On this iPhone you can jump straight into the shortcut with:
            </p>
            <a
              href="shortcuts://run-shortcut?name=Hey%20Nova"
              className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium tracking-wide text-white/80 transition hover:bg-white/10"
            >
              Run Hey Nova
            </a>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-amber-200/45">
              First-time setup
            </p>
            <ul className="list-disc space-y-2 pl-4">
              <li>
                Open Nova once in Safari and allow{" "}
                <span className="text-white/75">Microphone</span> when asked.
                That grant persists; later Shortcut opens can listen without a
                tap.
              </li>
              <li>
                Prefer Safari with the site already signed in. Private mode or
                a cold session will hit the login screen first.
              </li>
              <li>
                Keep the Nova tab in the foreground while talking; backgrounding
                Safari may stop recognition.
              </li>
              <li>
                Mic-only fallback ({" "}
                <span className="font-mono text-white/60">?listen=1</span> with
                no <span className="font-mono text-white/60">q</span>): Nova
                tries to greet in-page and opens the mic. If autoplay is
                blocked, listening still starts — the Shortcut Speak Text path
                above is preferred for glasses.
              </li>
            </ul>
          </div>
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
