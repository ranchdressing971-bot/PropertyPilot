import { ViolationDetailView } from "@/components/violations/ViolationDetailView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ViolationDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ViolationDetailView id={id} />;
}
