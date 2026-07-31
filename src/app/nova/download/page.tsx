import type { Metadata } from "next";
import Link from "next/link";
import { checkNexusAdmin } from "@/lib/nexus/admin";

export const metadata: Metadata = {
  title: "Download Nova APK",
  description: "Install Nova on an Android burner phone.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NovaDownloadPage() {
  const admin = await checkNexusAdmin();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#05030a] px-5 text-white">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          RideBy
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[0.18em]">
          NOVA
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Android wrapper for the Nova voice console — full screen, mic
          unlocked, keeps the screen on. Use it like a cheap Alexa on a burner
          phone.
        </p>

        {!admin.allowed ? (
          <p className="mt-6 text-sm text-amber-200/90">
            Sign in with an operator account to download the APK.
          </p>
        ) : (
          <a
            href="/downloads/nova.apk"
            className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 to-fuchsia-400/20 px-5 py-3.5 text-sm font-medium tracking-wide text-white transition hover:brightness-110"
          >
            Download Nova.apk
          </a>
        )}

        <ol className="mt-8 space-y-2 text-left text-xs leading-relaxed text-white/45">
          <li>1. Open this page on the phone (Chrome).</li>
          <li>2. Download the APK, then allow installs from Chrome if asked.</li>
          <li>3. Open Nova → allow microphone.</li>
          <li>4. Sign in, tap the orb once, say “Hey Nova”.</li>
        </ol>

        <div className="mt-8 flex items-center justify-center gap-4 text-xs">
          <Link href="/nova" className="text-cyan-200/70 hover:text-white">
            Open Nova in browser
          </Link>
          <Link href="/nexus" className="text-white/40 hover:text-white/70">
            Nexus
          </Link>
        </div>
      </div>
    </main>
  );
}
