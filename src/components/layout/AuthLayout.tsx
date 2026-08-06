import { Logo } from "@/components/brand/Logo";
import { RideByWordmark } from "@/components/brand/RideByWordmark";
import { Shield, Video } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(58,138,95,0.28),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_80%,rgba(43,111,75,0.18),transparent_45%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 70% 60% at 40% 40%, black, transparent)",
          }}
        />

        <Logo size="lg" href="/" variant="light" className="relative" />

        <div className="relative space-y-8">
          <div>
            <p className="page-eyebrow text-brand-300">HOA drive-throughs</p>
            <h2 className="mt-3 max-w-sm font-display text-3xl font-semibold leading-[1.15] tracking-tight text-white">
              Film the street. Review the flags.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
              Upload one neighborhood video. RideBy matches homes, attaches
              evidence, and waits for your approval.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: Video, text: "One video covers the whole route" },
              { icon: Shield, text: "You approve before anything is sent" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-400" />
                <span className="text-sm text-ink-200">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative inline-flex items-center gap-1.5 text-xs text-ink-600">
          <span>&copy; {new Date().getFullYear()}</span>
          <RideByWordmark variant="inherit" className="text-xs text-ink-600" />
        </p>
      </div>

      <div className="flex flex-col items-center justify-center bg-canvas px-5 py-12">
        <div className="mb-8 lg:hidden">
          <Logo size="lg" href="/" />
        </div>
        {children}
      </div>
    </div>
  );
}
