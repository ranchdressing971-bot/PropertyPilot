import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { ViolationCard } from "@/components/violations/ViolationCard";
import { violations } from "@/lib/mock-data";

export default function ViolationsPage() {
  const pending = violations.filter((v) => v.status === "pending");
  const reviewed = violations.filter((v) => v.status !== "pending");

  return (
    <DashboardLayout>
      <Header
        title="Violations"
        subtitle={`${pending.length} pending · ${violations.length} total`}
      />
      <PageContent>
        {pending.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pending Review
            </h2>
            <div className="space-y-5">
              {pending.map((v, i) => (
                <ViolationCard key={v.id} violation={v} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Reviewed
          </h2>
          <div className="space-y-5">
            {reviewed.map((v, i) => (
              <ViolationCard key={v.id} violation={v} index={i} />
            ))}
          </div>
        </section>
      </PageContent>
    </DashboardLayout>
  );
}
