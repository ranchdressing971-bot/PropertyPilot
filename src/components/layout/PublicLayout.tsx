import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

interface PublicLayoutProps {
  children: React.ReactNode;
  /** Show sign-in / demo actions in the nav */
  showNavActions?: boolean;
}

export function PublicLayout({ children, showNavActions = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <nav className="border-b border-ink-200/80 bg-canvas">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Logo size="md" href="/" />
          {showNavActions && (
            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                className="text-sm font-medium text-ink-500 hover:text-ink-900"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          )}
        </div>
      </nav>
      {children}
      <footer className="border-t border-ink-200/80 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <Logo size="sm" href="/" />
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-400">
            <Link href="/pricing" className="hover:text-ink-600">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-ink-600">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink-600">
              Terms
            </Link>
            <span>&copy; 2026 Property Pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
