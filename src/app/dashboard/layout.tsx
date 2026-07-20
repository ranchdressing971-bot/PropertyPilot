"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileNavProvider } from "@/components/layout/MobileNavContext";
import { PageTransition } from "@/components/layout/PageTransition";

/**
 * Persistent dashboard chrome — keeps sidebar mounted so route changes
 * can animate page content (not only on full refresh).
 */
export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-canvas">
        <Sidebar />
        <main className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:ml-[252px] lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileBottomNav />
      </div>
    </MobileNavProvider>
  );
}
