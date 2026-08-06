"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { JOB_STATUSES, SERVICE_TYPES, type Customer, type Job } from "@/lib/types";
import { jobSchema, type JobInput } from "@/lib/validations";
import { titleCaseStatus } from "@/lib/format";

export function JobForm({
  customers,
  initial,
  defaults,
  defaultRate,
  onSubmit,
  submitLabel,
}: {
  customers: Customer[];
  initial?: Job;
  defaults?: Partial<JobInput>;
  defaultRate: number;
  onSubmit: (values: JobInput) => void;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      customer_id: initial?.customer_id ?? defaults?.customer_id ?? "",
      title: initial?.title ?? defaults?.title ?? "",
      service_type: initial?.service_type ?? defaults?.service_type ?? SERVICE_TYPES[0],
      description: initial?.description ?? "",
      service_address_line1: initial?.service_address_line1 ?? "",
      service_address_line2: initial?.service_address_line2 ?? "",
      service_city: initial?.service_city ?? "",
      service_state: initial?.service_state ?? "",
      service_postal_code: initial?.service_postal_code ?? "",
      scheduled_date: initial?.scheduled_date ?? defaults?.scheduled_date ?? "",
      start_time: initial?.start_time ?? "",
      estimated_duration_minutes: initial?.estimated_duration_minutes ?? 90,
      status: initial?.status ?? "scheduled",
      labor_hours: initial?.labor_hours ?? 0,
      hourly_labor_rate: initial?.hourly_labor_rate ?? defaultRate,
      material_cost: initial?.material_cost ?? 0,
      other_expenses: initial?.other_expenses ?? 0,
      amount_charged: initial?.amount_charged ?? 0,
      internal_notes: initial?.internal_notes ?? "",
      customer_notes: initial?.customer_notes ?? "",
      assigned_technician_name: initial?.assigned_technician_name ?? "",
    },
  });

  const customerId = watch("customer_id");

  useEffect(() => {
    if (!customerId || initial) return;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setValue("service_address_line1", customer.service_address_line1 ?? "");
    setValue("service_address_line2", customer.service_address_line2 ?? "");
    setValue("service_city", customer.service_city ?? "");
    setValue("service_state", customer.service_state ?? "");
    setValue("service_postal_code", customer.service_postal_code ?? "");
  }, [customerId, customers, initial, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Customer"
        placeholder="Select customer"
        options={customers.map((c) => ({ value: c.id, label: c.full_name }))}
        error={errors.customer_id?.message}
        {...register("customer_id")}
      />
      <Input label="Job title" error={errors.title?.message} {...register("title")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Service type"
          options={SERVICE_TYPES.map((s) => ({ value: s, label: s }))}
          {...register("service_type")}
        />
        <Select
          label="Status"
          options={JOB_STATUSES.map((s) => ({ value: s, label: titleCaseStatus(s) }))}
          {...register("status")}
        />
      </div>
      <Textarea label="Description" {...register("description")} />
      <Input label="Service address" {...register("service_address_line1")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" {...register("service_city")} />
        <Input label="State" {...register("service_state")} />
        <Input label="Postal" {...register("service_postal_code")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Scheduled date" type="date" {...register("scheduled_date")} />
        <Input label="Start time" type="time" {...register("start_time")} />
        <Input
          label="Duration (minutes)"
          type="number"
          {...register("estimated_duration_minutes")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Labor hours" type="number" step="0.25" {...register("labor_hours")} />
        <Input label="Hourly labor rate" type="number" step="0.01" {...register("hourly_labor_rate")} />
        <Input label="Material cost" type="number" step="0.01" {...register("material_cost")} />
        <Input label="Other expenses" type="number" step="0.01" {...register("other_expenses")} />
      </div>
      <Input label="Amount charged" type="number" step="0.01" {...register("amount_charged")} />
      <Input label="Assigned technician" {...register("assigned_technician_name")} />
      <Textarea label="Internal notes" {...register("internal_notes")} />
      <Textarea label="Customer-facing notes" {...register("customer_notes")} />
      <Button type="submit" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
