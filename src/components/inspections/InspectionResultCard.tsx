"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { AddressConfirmPanel } from "@/components/inspections/AddressConfirmPanel";
import { EditableAddress } from "@/components/inspections/EditableAddress";
import { Property, Violation } from "@/lib/mock-data";
import {
  CheckCircle2,
  ArrowRight,
  FileText,
  MapPin,
  Loader2,
  Trash2,
} from "lucide-react";
import { staggerItem } from "@/lib/motion";

interface InspectionResultCardProps {
  property: Property;
  violation: Violation | null;
  inspectionId: string;
  index: number;
  onAddressConfirmed?: (propertyId: string, address: string) => void;
  onDelete?: (propertyId: string) => Promise<void> | void;
}

export function InspectionResultCard({
  property,
  violation,
  inspectionId,
  onAddressConfirmed,
  onDelete,
}: InspectionResultCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete || deleting) return;
    const ok = confirm(
      `Remove ${property.address} from this inspection? This also removes it from the community list if it was added.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete(property.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      variants={staggerItem}
      layout={false}
      whileHover={{ y: -6, scale: 1.015, transition: { duration: 0.22 } }}
      style={{ transformOrigin: "center top" }}
    >
      <Card hover className="overflow-hidden">
        <div className="relative h-32 w-full overflow-hidden rounded-xl sm:h-40">
          <MediaImage src={property.image} alt={property.address} fill className="object-cover" />
          {onDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1.5 text-xs font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
              aria-label={`Remove ${property.address}`}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            {onAddressConfirmed ? (
              <EditableAddress
                address={property.address}
                inspectionId={inspectionId}
                propertyId={property.id}
                onSaved={(newAddress) =>
                  onAddressConfirmed(property.id, newAddress)
                }
              />
            ) : (
              <h3 className="text-sm font-semibold leading-snug text-ink-900 sm:text-base">
                {property.address}
              </h3>
            )}
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
