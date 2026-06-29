import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Header title="Dashboard" subtitle="Willow Creek Estates overview" />
      <DashboardContent />
    </DashboardLayout>
  );
}
