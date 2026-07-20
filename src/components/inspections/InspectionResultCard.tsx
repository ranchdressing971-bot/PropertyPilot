"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { AddressConfirmPanel } from "@/components/inspections/AddressConfirmPanel";
import { Property, Violation } from "@/lib/mock-data";
import { CheckCircle2, ArrowRight, FileText, MapPin } from "lucide-react";

interface InspectionResultCardProps {
  property: Property;
  violation: Violation | null;
  inspectionId: string;
  index: number;
  onAddressConfirmed?: (propertyId: string, address: string) => void;
}

export function InspectionResultCard({
  property,
  violation,
  inspectionId,
  index,
  onAddressConfirmed,
}: InspectionResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.06, 0.45),
        type: "spring",
        stiffness: 380,
        damping: 26,
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Card hover className="overflow-hidden">
        <div className="relative h-32 w-full overflow-hidden rounded-xl sm:h-40">
          <MediaImage src={property.image} alt={property.address} fill className="object-cover" />
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

          {property.needsAddressReview && onAddressConfirmed && (
            <AddressConfirmPanel
              inspectionId={inspectionId}
              propertyId={property.id}
              address={property.address}
              confidence={property.addressConfidence}
              onConfirmed={(newAddress) =>
                onAddressConfirmed(property.id, newAddress)
              }
            />
          )}

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
