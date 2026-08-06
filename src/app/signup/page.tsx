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
import { signUpSchema } from "@/lib/validations";

type FormValues = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      if (!isSupabaseClientConfigured()) {
        toast("Supabase is not configured yet. Explore the demo instead.", "info");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.fullName } },
      });
      if (error) {
        toast(formatSupabaseAuthError(error.message), "error");
        return;
      }
      document.cookie = `${DEMO_MODE_COOKIE}=live; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      toast("Account created. Let’s set up your business.");
      router.push("/dashboard/onboarding");
    } catch {
      toast("Unable to sign up right now. Try again shortly.", "error");
    } finally {
      setLoading(false);
    }
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
          <h1 className="font-display text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500">
            Start managing jobs, invoices, and profit in one place.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input
              label="Full name"
              error={errors.fullName?.message}
              {...register("fullName")}
            />
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
              autoComplete="new-password"
              error={errors.password?.message}
              hint="At least 8 characters"
              {...register("password")}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              document.cookie = `${DEMO_MODE_COOKIE}=demo; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
              router.push("/dashboard");
            }}
          >
            Try demo instead
          </Button>
          <p className="mt-5 text-center text-sm text-ink-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
