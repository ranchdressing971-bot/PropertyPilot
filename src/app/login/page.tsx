import { Suspense } from "react";
import LoginPageInner from "./LoginPageInner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <Loader2 className="h-8 w-8 animate-spin text-copper-600" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
