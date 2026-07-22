import type { Metadata } from "next";
import { FreeLanding } from "@/components/marketing/FreeLanding";

export const metadata: Metadata = {
  title: "RideBy — HOA Drive-Through Inspections",
  description:
    "Upload a neighborhood drive-through. RideBy flags homes that need review so managers can approve notices with confidence.",
};

export default function HomePage() {
  return <FreeLanding variant="home" />;
}
