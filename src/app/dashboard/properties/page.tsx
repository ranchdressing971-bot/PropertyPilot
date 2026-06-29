import Link from "next/link";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { properties } from "@/lib/mock-data";
import { ArrowRight, Calendar } from "lucide-react";

export default function PropertiesPage() {
  return (
    <DashboardLayout>
      <Header
        title="Properties"
        subtitle={`${properties.length} homes in Willow Creek Estates`}
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
              <Card hover className="overflow-hidden">
                <div className="relative h-44 w-full overflow-hidden rounded-xl sm:h-36">
                  <Image
                    src={property.image}
                    alt={property.address}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="mt-5 space-y-3">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold leading-snug text-slate-900">
                      {property.address}
                    </h3>
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Calendar className="h-4 w-4 shrink-0" />
                      Inspected {property.lastInspection}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Badge status={property.status} />
                    <span className="flex items-center text-sm font-medium text-accent-600">
                      Details
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </PageContent>
    </DashboardLayout>
  );
}
