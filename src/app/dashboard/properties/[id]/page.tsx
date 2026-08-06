import { PropertyDetailPageClient } from "@/components/pages/PropertyDetailPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inspection?: string }>;
}

export default async function PropertyDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { inspection } = await searchParams;
  return <PropertyDetailPageClient id={id} inspectionId={inspection} />;
}
