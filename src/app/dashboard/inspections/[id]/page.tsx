import { InspectionResultsView } from "@/components/inspections/InspectionResultsView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InspectionResultsPage({ params }: PageProps) {
  const { id } = await params;
  return <InspectionResultsView id={id} />;
}
