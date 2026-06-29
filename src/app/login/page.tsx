import { Suspense } from "react";
import LoginPageInner from "./LoginPageInner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
