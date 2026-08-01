import type { Metadata } from "next";
import Link from "next/link";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { getAppUrl } from "@/lib/stripe";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Hey Nova · iOS Shortcut",
  description:
    "Set up the Hey Nova Siri Shortcut for Bluetooth glasses and iPhone.",
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
          One Siri Shortcut so the glasses button opens Nova already listening.
          No second wake phrase.
        </p>

        <div className="mt-7 rounded-2xl border border-cyan-300/20 bg-white/[0.04] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/55">
            URL for the shortcut
          </p>
          <p className="mt-2 break-all font-mono text-sm text-cyan-100/90">
            {listenUrl}
          </p>
          <p className="mt-2 text-xs text-white/40">
            Same result:{" "}
            <span className="font-mono text-white/55">{goUrl}</span>
          </p>
        </div>

        <div className="mt-8 space-y-5 text-left text-xs leading-relaxed text-white/50">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
              Create the shortcut
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
                app on your iPhone.
              </li>
              <li>
                2. Tap <span className="text-white/75">+</span> (or All
                Shortcuts → +) to create a new shortcut.
              </li>
              <li>
                3. Add action:{" "}
                <span className="text-white/75">Open URLs</span> (search
                &quot;Open URL&quot;).
              </li>
              <li>
                4. Paste this URL:
                <code className="mt-1.5 block rounded-lg bg-white/5 px-2.5 py-2 font-mono text-[11px] text-cyan-100/85">
                  {listenUrl}
                </code>
              </li>
              <li>
                5. Tap the shortcut name at the top → rename to{" "}
                <span className="text-white/80">Hey Nova</span> exactly.
              </li>
              <li>
                6. Tap Done. Optional: Add to Home Screen, or set as the
                Side Button / Action Button shortcut if you use that.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
              Run from Siri / glasses
            </p>
            <ol className="space-y-2.5">
              <li>
                1. Say <span className="text-white/80">&quot;Hey Siri, Hey
                Nova&quot;</span> or press the Siri button / glasses stem and
                say <span className="text-white/80">&quot;Hey Nova&quot;</span>.
              </li>
              <li>
                2. Safari (or your default browser) opens Nova with the mic in
                open listen. Speak your command; do not say &quot;hey nova&quot;
                again.
              </li>
              <li>
                3. Stay signed in to the operator account in that browser so the
                shortcut skips the login wall.
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
              iPhone / Safari notes
            </p>
            <ul className="list-disc space-y-2 pl-4">
              <li>
                First open: allow Microphone when Safari asks. Without that
                grant, Nova cannot listen.
              </li>
              <li>
                iOS sometimes needs one screen tap after a Shortcut opens a
                page before the mic starts. If you see &quot;Tap once to
                listen,&quot; tap the orb or anywhere on the screen once.
              </li>
              <li>
                Prefer Safari with the site already signed in. Private mode or
                a cold session will hit the login screen first.
              </li>
              <li>
                Speech recognition works best while the Nova tab stays in the
                foreground; backgrounding Safari may stop the mic.
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
