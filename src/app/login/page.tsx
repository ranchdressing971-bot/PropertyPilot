"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wind } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { DEMO_MODE_COOKIE } from "@/lib/demo/data";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { formatSupabaseAuthError } from "@/lib/supabase/config";
import { signInSchema } from "@/lib/validations";

type FormValues = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      if (!isSupabaseClientConfigured()) {
        toast("Supabase is not configured. Use the demo instead.", "error");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        toast(formatSupabaseAuthError(error.message), "error");
        return;
      }
      document.cookie = `${DEMO_MODE_COOKIE}=live; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      router.push("/dashboard");
    } catch {
      toast("Unable to sign in. Check your connection and try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    document.cookie = `${DEMO_MODE_COOKIE}=demo; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-cta">
            <Wind className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold">TradeFlow</span>
        </div>
        <div className="surface p-6">
          <h1 className="font-display text-2xl font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Access your HVAC business workspace.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-brand-700">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <Button variant="secondary" className="mt-3 w-full" onClick={enterDemo}>
            Try demo
          </Button>
          <p className="mt-5 text-center text-sm text-ink-500">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-brand-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
