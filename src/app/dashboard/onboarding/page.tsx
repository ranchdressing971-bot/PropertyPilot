"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import { onboardingSchema } from "@/lib/validations";

type FormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { business, updateBusiness } = useTradeFlow();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessName: business.name === "Coastal Air & Heating" ? "" : business.name,
      ownerName: business.owner_name ?? "",
      phone: business.phone ?? "",
      email: business.email ?? "",
      addressLine1: business.address_line1 ?? "",
      addressLine2: business.address_line2 ?? "",
      city: business.city ?? "",
      state: business.state ?? "",
      postalCode: business.postal_code ?? "",
      defaultHourlyLaborRate: business.default_hourly_labor_rate,
      defaultTaxRate: business.default_tax_rate * 100,
      currency: business.currency || "USD",
      logoUrl: business.logo_url ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    updateBusiness({
      name: values.businessName,
      owner_name: values.ownerName,
      phone: values.phone,
      email: values.email,
      address_line1: values.addressLine1,
      address_line2: values.addressLine2 || null,
      city: values.city,
      state: values.state,
      postal_code: values.postalCode,
      default_hourly_labor_rate: values.defaultHourlyLaborRate,
      default_tax_rate: values.defaultTaxRate / 100,
      currency: values.currency,
      logo_url: values.logoUrl || null,
      onboarding_completed: true,
    });
    toast("Business profile saved.");
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="page-title">Set up your business</h1>
      <p className="mt-2 text-sm text-ink-500">
        A few details so invoices, rates, and tax calculate correctly from day one.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="surface mt-6 space-y-4 p-5">
        <Input label="Business name" error={errors.businessName?.message} {...register("businessName")} />
        <Input label="Owner name" error={errors.ownerName?.message} {...register("ownerName")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
          <Input label="Business email" type="email" error={errors.email?.message} {...register("email")} />
        </div>
        <Input label="Address" error={errors.addressLine1?.message} {...register("addressLine1")} />
        <Input label="Address line 2 (optional)" {...register("addressLine2")} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="City" error={errors.city?.message} {...register("city")} />
          <Input label="State" error={errors.state?.message} {...register("state")} />
          <Input label="Postal code" error={errors.postalCode?.message} {...register("postalCode")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Default hourly labor rate"
            type="number"
            step="0.01"
            error={errors.defaultHourlyLaborRate?.message}
            {...register("defaultHourlyLaborRate")}
          />
          <Input
            label="Default tax rate (%)"
            type="number"
            step="0.01"
            error={errors.defaultTaxRate?.message}
            {...register("defaultTaxRate")}
          />
          <Select
            label="Currency"
            options={[
              { value: "USD", label: "USD" },
              { value: "CAD", label: "CAD" },
              { value: "EUR", label: "EUR" },
              { value: "GBP", label: "GBP" },
            ]}
            error={errors.currency?.message}
            {...register("currency")}
          />
        </div>
        <Input
          label="Logo URL (optional)"
          placeholder="https://…"
          error={errors.logoUrl?.message}
          {...register("logoUrl")}
        />
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          Finish setup
        </Button>
      </form>
    </div>
  );
}
