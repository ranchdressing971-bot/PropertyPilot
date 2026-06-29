"use client";

import { Sidebar } from "./Sidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileNavProvider } from "./MobileNavContext";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-canvas">
        <Sidebar />
        <main className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:ml-[240px] lg:pb-0">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </MobileNavProvider>
  );
}
