import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { ViolationCard } from "@/components/violations/ViolationCard";
import { violations } from "@/lib/mock-data";

export default function ViolationsPage() {
  const pending = violations.filter((v) => v.status === "pending");
  const reviewed = violations.filter((v) => v.status !== "pending");

  return (
    <DashboardLayout>
      <Header
        title="Violations"
        subtitle={`${pending.length} pending review · ${violations.length} total`}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Pending Review
            </h2>
            <div className="space-y-3">
              {pending.map((v, i) => (
                <ViolationCard key={v.id} violation={v} index={i} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Reviewed
          </h2>
          <div className="space-y-3">
            {reviewed.map((v, i) => (
              <ViolationCard key={v.id} violation={v} index={i} />
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
