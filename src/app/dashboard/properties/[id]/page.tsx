import { PropertyDetailPageClient } from "@/components/pages/PropertyDetailPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PropertyDetailPageClient id={id} />;
}
