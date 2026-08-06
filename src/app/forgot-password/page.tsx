"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wind } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { formatSupabaseAuthError } from "@/lib/supabase/config";
import { forgotPasswordSchema } from "@/lib/validations";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      if (!isSupabaseClientConfigured()) {
        toast("Password reset requires Supabase configuration.", "error");
        return;
      }
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${origin}/login`,
      });
      if (error) {
        toast(formatSupabaseAuthError(error.message), "error");
        return;
      }
      setSent(true);
      toast("Check your email for a reset link.");
    } catch {
      toast("Unable to send reset email right now.", "error");
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
          <h1 className="font-display text-2xl font-semibold">Reset password</h1>
          <p className="mt-1 text-sm text-ink-500">
            We&apos;ll email you a secure link to choose a new password.
          </p>
          {sent ? (
            <div className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              Reset email sent. Check your inbox, then{" "}
              <Link href="/login" className="font-semibold underline">
                sign in
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <Input
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register("email")}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-ink-500">
            <Link href="/login" className="font-semibold text-brand-700">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
