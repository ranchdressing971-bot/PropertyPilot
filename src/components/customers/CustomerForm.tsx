"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import type { Customer } from "@/lib/types";

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: Customer;
  onSubmit: (values: CustomerInput) => void;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: initial?.full_name ?? "",
      company_name: initial?.company_name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      billing_address_line1: initial?.billing_address_line1 ?? "",
      billing_address_line2: initial?.billing_address_line2 ?? "",
      billing_city: initial?.billing_city ?? "",
      billing_state: initial?.billing_state ?? "",
      billing_postal_code: initial?.billing_postal_code ?? "",
      service_address_line1: initial?.service_address_line1 ?? "",
      service_address_line2: initial?.service_address_line2 ?? "",
      service_city: initial?.service_city ?? "",
      service_state: initial?.service_state ?? "",
      service_postal_code: initial?.service_postal_code ?? "",
      notes: initial?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
      <Input label="Company name (optional)" {...register("company_name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Phone" {...register("phone")} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink-800">Billing address</p>
          <Input label="Street" {...register("billing_address_line1")} />
          <Input label="Line 2" {...register("billing_address_line2")} />
          <Input label="City" {...register("billing_city")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="State" {...register("billing_state")} />
            <Input label="Postal" {...register("billing_postal_code")} />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink-800">Service address</p>
          <Input label="Street" {...register("service_address_line1")} />
          <Input label="Line 2" {...register("service_address_line2")} />
          <Input label="City" {...register("service_city")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="State" {...register("service_state")} />
            <Input label="Postal" {...register("service_postal_code")} />
          </div>
        </div>
      </div>
      <Textarea label="Notes" {...register("notes")} />
      <Button type="submit" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
