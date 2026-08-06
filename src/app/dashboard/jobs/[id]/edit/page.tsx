"use client";

import { useParams, useRouter } from "next/navigation";
import { JobForm } from "@/components/jobs/JobForm";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import type { JobStatus } from "@/lib/types";
import type { JobInput } from "@/lib/validations";

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { jobs, customers, business, updateJob } = useTradeFlow();
  const job = jobs.find((j) => j.id === params.id);

  if (!job) {
    return <Card><p className="text-sm text-ink-600">Job not found.</p></Card>;
  }

  function onSubmit(values: JobInput) {
    updateJob(job!.id, {
      customer_id: values.customer_id,
      title: values.title,
      service_type: values.service_type,
      description: values.description || null,
      service_address_line1: values.service_address_line1 || null,
      service_address_line2: values.service_address_line2 || null,
      service_city: values.service_city || null,
      service_state: values.service_state || null,
      service_postal_code: values.service_postal_code || null,
      scheduled_date: values.scheduled_date || null,
      start_time: values.start_time || null,
      estimated_duration_minutes: values.estimated_duration_minutes ?? null,
      status: values.status as JobStatus,
      labor_hours: Number(values.labor_hours) || 0,
      hourly_labor_rate: Number(values.hourly_labor_rate) || 0,
      material_cost: Number(values.material_cost) || 0,
      other_expenses: Number(values.other_expenses) || 0,
      amount_charged: Number(values.amount_charged) || 0,
      internal_notes: values.internal_notes || null,
      customer_notes: values.customer_notes || null,
      assigned_technician_name: values.assigned_technician_name || null,
    });
    toast("Job updated.");
    router.push(`/dashboard/jobs/${job!.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <h1 className="page-title">Edit job</h1>
      <div className="surface p-5">
        <JobForm
          customers={customers}
          initial={job}
          defaultRate={business.default_hourly_labor_rate}
          onSubmit={onSubmit}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
