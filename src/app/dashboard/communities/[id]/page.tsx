import { CommunityDetailPageClient } from "@/components/pages/CommunityDetailPageClient";

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityDetailPageClient id={id} />;
}
