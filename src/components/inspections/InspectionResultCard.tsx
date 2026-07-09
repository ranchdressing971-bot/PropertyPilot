"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Property, Violation } from "@/lib/mock-data";
import { CheckCircle2, ArrowRight, FileText, Home, MapPin } from "lucide-react";

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
      <div className="flex h-full w-full items-center justify-center bg-ink-100">
        <Home className="h-10 w-10 text-ink-300" />
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
        <div className="relative h-32 w-full overflow-hidden rounded-xl sm:h-40">
          <PropertyPhoto src={property.image} alt={property.address} />
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold leading-snug text-ink-900 sm:text-base">
              {property.address}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge status={property.status} />
              {property.previouslyInspected && (
                <span className="inline-flex items-center rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                  Already inspected
                </span>
              )}
              {property.needsAddressReview && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <MapPin className="h-3 w-3" />
                  Confirm address
                </span>
              )}
            </div>
          </div>

          {violation ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
                  Possible violation
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-amber-900">
                  {violation.type}
                </p>
                <p className="mt-2 text-xs text-amber-900/80">
                  {violation.confidence}% confidence · {violation.recommendation}
                </p>
              </div>
              <Link href={`/dashboard/violations/${violation.id}`}>
                <Button variant="secondary" size="sm" className="w-full">
                  Review
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
                <p className="text-sm font-medium text-brand-800">No violations</p>
              </div>
              <Link
                href={`/dashboard/properties/${property.id}?inspection=${inspectionId}`}
              >
                <Button variant="secondary" size="sm" className="w-full">
                  <FileText className="h-4 w-4" />
                  Good standing report
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
