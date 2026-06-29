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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover>
        <div className="flex gap-4">
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={violation.evidenceImages[0]}
              alt="Evidence"
              fill
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.address}
                </p>
                <h3 className="mt-1 font-semibold text-slate-900">
                  {violation.type}
                </h3>
              </div>
              <Badge status={violation.status} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-slate-500">
                Confidence:{" "}
                <span className="font-semibold text-slate-900">
                  {violation.confidence}%
                </span>
              </span>
              <span className="text-slate-500">
                {violation.recommendation}
              </span>
            </div>
            <Link href={`/dashboard/violations/${violation.id}`}>
              <Button variant="ghost" size="sm" className="mt-2 -ml-2">
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
