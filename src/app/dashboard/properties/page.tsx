import Link from "next/link";
import Image from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { properties } from "@/lib/mock-data";
import { ArrowRight, Calendar } from "lucide-react";

export default function PropertiesPage() {
  return (
    <DashboardLayout>
      <Header title="Properties" subtitle={`${properties.length} properties in Willow Creek Estates`} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
              <Card hover className="overflow-hidden">
                <div className="relative h-36 w-full overflow-hidden rounded-lg">
                  <Image
                    src={property.image}
                    alt={property.address}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{property.address}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      Last inspected {property.lastInspection}
                    </p>
                  </div>
                  <Badge status={property.status} />
                </div>
                <div className="mt-3 flex items-center text-sm font-medium text-accent-600">
                  View Details
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
