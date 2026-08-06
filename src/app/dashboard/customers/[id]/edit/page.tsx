"use client";

import { useParams, useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import type { CustomerInput } from "@/lib/validations";

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { customers, updateCustomer } = useTradeFlow();
  const customer = customers.find((c) => c.id === params.id);

  if (!customer) {
    return <Card><p className="text-sm text-ink-600">Customer not found.</p></Card>;
  }

  function onSubmit(values: CustomerInput) {
    updateCustomer(customer!.id, values);
    toast("Customer updated.");
    router.push(`/dashboard/customers/${customer!.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <h1 className="page-title">Edit customer</h1>
      <div className="surface p-5">
        <CustomerForm initial={customer} onSubmit={onSubmit} submitLabel="Save changes" />
      </div>
    </div>
  );
}
