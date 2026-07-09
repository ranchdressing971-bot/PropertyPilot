"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { Violation, getProperty } from "@/lib/mock-data";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { ArrowRight, MapPin } from "lucide-react";

interface ViolationCardProps {
  violation: Violation;
  index: number;
}

export function ViolationCard({ violation }: ViolationCardProps) {
  const { isDemo } = useAppMode();
  const { data: live } = useLiveDashboard(!isDemo);

  const property = isDemo
    ? getProperty(violation.propertyId)
    : live?.properties.find((p) => p.id === violation.propertyId);

  if (!property && isDemo) return null;

  const address = property?.address ?? "Unknown address";
  const imageSrc = violation.evidenceImages[0] ?? property?.image;

  return (
    <Card hover>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-28">
          <MediaImage src={imageSrc} alt="Evidence" fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <MapPin className="h-3.5 w-3.5" />
            {address}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-ink-900">{violation.type}</h3>
            <Badge status={violation.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {violation.confidence}% confidence · {violation.recommendation}
          </p>
          <Link href={`/dashboard/violations/${violation.id}`} className="mt-3 inline-block">
            <Button variant="secondary" size="sm">
              Review
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
