"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Violation, getProperty } from "@/lib/mock-data";
import { ArrowRight, MapPin } from "lucide-react";

interface ViolationCardProps {
  violation: Violation;
  index: number;
}

export function ViolationCard({ violation, index }: ViolationCardProps) {
  const property = getProperty(violation.propertyId);
  if (!property) return null;

  const imageSrc =
    violation.evidenceImages[0] ?? property.image;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
          <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-32">
            <Image src={imageSrc} alt="Evidence" fill className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" />
                {property.address}
              </p>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-snug text-slate-900">
                  {violation.type}
                </h3>
                <Badge status={violation.status} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-slate-500">
                Confidence:{" "}
                <span className="font-semibold text-slate-900">
                  {violation.confidence}%
                </span>
              </span>
              <span className="text-slate-500">{violation.recommendation}</span>
            </div>
            <Link href={`/dashboard/violations/${violation.id}`}>
              <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                Review
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
