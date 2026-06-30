import { Logo } from "@/components/brand/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-12">
      <div className="mb-8">
        <Logo size="lg" href="/" />
      </div>
      {children}
    </div>
  );
}
