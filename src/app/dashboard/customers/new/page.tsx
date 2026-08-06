"use client";

import { useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { useToast } from "@/components/providers/ToastProvider";
import { useTradeFlow } from "@/components/providers/TradeFlowProvider";
import type { CustomerInput } from "@/lib/validations";

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createCustomer } = useTradeFlow();

  function onSubmit(values: CustomerInput) {
    const customer = createCustomer(values);
    toast("Customer added.");
    router.push(`/dashboard/customers/${customer.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <h1 className="page-title">Add customer</h1>
      <div className="surface p-5">
        <CustomerForm onSubmit={onSubmit} submitLabel="Save customer" />
      </div>
    </div>
  );
}
