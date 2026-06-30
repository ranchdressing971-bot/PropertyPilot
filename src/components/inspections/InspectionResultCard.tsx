"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Property, Violation } from "@/lib/mock-data";
import { CheckCircle2, ArrowRight, FileText, Home } from "lucide-react";

interface InspectionResultCardProps {
  property: Property;
  violation: Violation | null;
  inspectionId: string;
  index: number;
}

function isSupabaseStorageUrl(src: string): boolean {
  return src.includes("supabase.co/storage/");
}

function PropertyPhoto({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <Home className="h-10 w-10 text-slate-300" />
      </div>
    );
  }

  if (src.startsWith("data:") || isSupabaseStorageUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    );
  }

  return <Image src={src} alt={alt} fill className="object-cover" unoptimized />;
}

export function InspectionResultCard({
  property,
  violation,
  inspectionId,
  index,
}: InspectionResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover className="overflow-hidden">
        <div className="relative h-44 w-full overflow-hidden rounded-xl sm:h-40">
          <PropertyPhoto src={property.image} alt={property.address} />
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold leading-snug text-slate-900">
              {property.address}
            </h3>
            <Badge status={property.status} />
          </div>

          {violation ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  Possible Violation
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug text-amber-900">
                  {violation.type}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-semibold text-slate-900">
                    {violation.confidence}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${violation.confidence}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Recommendation</span>
                <span className="text-right font-medium text-slate-900">
                  {violation.recommendation}
                </span>
              </div>

              <Link href={`/dashboard/violations/${violation.id}`}>
                <Button variant="secondary" size="sm" className="mt-1 w-full">
                  Review Violation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">No Violations</p>
              </div>
              <Link
                href={`/dashboard/properties/${property.id}?inspection=${inspectionId}`}
              >
                <Button variant="secondary" size="sm" className="w-full">
                  <FileText className="h-4 w-4" />
                  Good Property Report
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
