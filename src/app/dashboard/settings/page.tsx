"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { businessSettingsSchema } from "@/lib/validations";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import { DEMO_MODE_COOKIE } from "@/lib/demo/data";

type FormValues = z.infer<typeof businessSettingsSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { business, updateBusiness, resetDemo, mode } = useTradeFlow();
  const stripeConfigured = Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: business.name,
      owner_name: business.owner_name ?? "",
      phone: business.phone ?? "",
      email: business.email ?? "",
      address_line1: business.address_line1 ?? "",
      address_line2: business.address_line2 ?? "",
      city: business.city ?? "",
      state: business.state ?? "",
      postal_code: business.postal_code ?? "",
      default_hourly_labor_rate: business.default_hourly_labor_rate,
      default_tax_rate: business.default_tax_rate,
      currency: business.currency,
      invoice_prefix: business.invoice_prefix,
      invoice_next_number: business.invoice_next_number,
      default_payment_terms_days: business.default_payment_terms_days,
      default_invoice_note: business.default_invoice_note ?? "",
      reminders_enabled: business.reminders_enabled,
      logo_url: business.logo_url ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    updateBusiness({
      ...values,
      email: values.email || null,
      phone: values.phone || null,
      default_invoice_note: values.default_invoice_note || null,
      logo_url: values.logo_url || null,
    });
    toast("Settings saved.");
  }

  async function signOut() {
    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    document.cookie = `${DEMO_MODE_COOKIE}=demo; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push("/login");
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Business profile, invoices, tax, labor, payments, and reminders.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <h2 className="font-display text-lg font-semibold">Business profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Business name" error={errors.name?.message} {...register("name")} />
            <Input label="Owner name" error={errors.owner_name?.message} {...register("owner_name")} />
            <Input label="Phone" {...register("phone")} />
            <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
            <Input label="Address" className="sm:col-span-2" {...register("address_line1")} />
            <Input label="City" {...register("city")} />
            <Input label="State" {...register("state")} />
            <Input label="Postal code" {...register("postal_code")} />
            <Input label="Currency" {...register("currency")} />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Invoice settings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Invoice prefix" {...register("invoice_prefix")} />
            <Input
              label="Next invoice number"
              type="number"
              {...register("invoice_next_number")}
            />
            <Input
              label="Default payment terms (days)"
              type="number"
              {...register("default_payment_terms_days")}
            />
            <Textarea
              label="Default invoice note"
              className="sm:col-span-2"
              {...register("default_invoice_note")}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Tax & labor defaults</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Default tax rate (0–1)"
              type="number"
              step="0.0001"
              hint="Example: 0.07 for 7%"
              error={errors.default_tax_rate?.message}
              {...register("default_tax_rate")}
            />
            <Input
              label="Default hourly labor rate"
              type="number"
              step="0.01"
              {...register("default_hourly_labor_rate")}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Payment settings</h2>
          <p className="mt-2 text-sm text-ink-600">
            Stripe test mode:{" "}
            <span className={stripeConfigured ? "font-semibold text-emerald-700" : "font-semibold text-signal-700"}>
              {stripeConfigured ? "Configured" : "Not configured"}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Set <code>STRIPE_SECRET_KEY</code> (sk_test_…) and{" "}
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (pk_test_…) in `.env.local`.
          </p>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Reminder settings</h2>
          <label className="mt-4 flex items-center gap-3 text-sm font-medium text-ink-800">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300" {...register("reminders_enabled")} />
            Send automatic payment reminders (due date, 3 / 7 / 14 days overdue)
          </label>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Branding</h2>
          <div className="mt-4">
            <Input label="Logo URL" placeholder="https://…" {...register("logo_url")} />
          </div>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          Save settings
        </Button>
      </form>

      <Card>
        <h2 className="font-display text-lg font-semibold">Account & security</h2>
        <p className="mt-2 text-sm text-ink-500">
          Mode: <span className="font-semibold text-ink-800">{mode}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              resetDemo();
              toast("Demo data reset to Coastal Air & Heating.");
            }}
          >
            Reset demo data
          </Button>
          <Button variant="ghost" onClick={() => router.push("/forgot-password")}>
            Change password
          </Button>
        </div>
      </Card>
    </div>
  );
}
