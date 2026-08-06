"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JobForm } from "@/components/jobs/JobForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import type { JobInput } from "@/lib/validations";

export default function NewJobPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <NewJobPageInner />
    </Suspense>
  );
}

function NewJobPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { customers, business, createJob } = useTradeFlow();

  function onSubmit(values: JobInput) {
    const job = createJob(values);
    toast("Job created.");
    router.push(`/dashboard/jobs/${job.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <h1 className="page-title">New job</h1>
      <div className="surface p-5">
        <JobForm
          customers={customers}
          defaultRate={business.default_hourly_labor_rate}
          defaults={{
            customer_id: params.get("customer") ?? "",
            scheduled_date: params.get("date") ?? "",
          }}
          onSubmit={onSubmit}
          submitLabel="Create job"
        />
      </div>
    </div>
  );
}
