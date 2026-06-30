import { Logo } from "@/components/brand/Logo";
import { Shield, Video } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.15),_transparent_50%)]" />
        <Logo size="lg" href="/" variant="light" className="relative" />

        <div className="relative space-y-8">
          <div>
            <p className="text-sm font-medium text-brand-400">Property Pilot</p>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
              HOA inspections, without the clip-by-clip grind.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
              Upload a drive-through video. AI scans every property and prepares
              compliance reports for your review.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Video, text: "One video, every home on the route" },
              { icon: Shield, text: "CC&R checks with evidence frames" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 rounded-xl border border-ink-800/80 bg-ink-900/40 px-4 py-3"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-400" />
                <span className="text-sm text-ink-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-ink-600">
          &copy; {new Date().getFullYear()} Property Pilot
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
