"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Property, Violation } from "@/lib/mock-data";
import { CheckCircle2, ArrowRight, FileText } from "lucide-react";

interface InspectionResultCardProps {
  property: Property;
  violation: Violation | null;
  index: number;
}

export function InspectionResultCard({
  property,
  violation,
  index,
}: InspectionResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover className="overflow-hidden">
        <div className="relative h-40 w-full overflow-hidden rounded-lg">
          <Image
            src={property.image}
            alt={property.address}
            fill
            className="object-cover"
          />
        </div>

        <div className="mt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900">{property.address}</h3>
            <Badge status={property.status} />
          </div>

          {violation ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  Possible Violations
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-900">
                  {violation.type}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Confidence</span>
                <span className="font-semibold text-slate-900">
                  {violation.confidence}%
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${violation.confidence}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Recommendation</span>
                <span className="font-medium text-slate-900">
                  {violation.recommendation}
                </span>
              </div>

              <Link href={`/dashboard/violations/${violation.id}`}>
                <Button variant="secondary" size="sm" className="mt-2 w-full">
                  Review Violation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">
                  No Violations
                </p>
              </div>
              <Link href={`/dashboard/properties/${property.id}`}>
                <Button variant="secondary" size="sm" className="w-full">
                  <FileText className="h-4 w-4" />
                  Generate Good Property Report
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
