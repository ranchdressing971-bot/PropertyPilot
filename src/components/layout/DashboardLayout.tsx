"use client";

import { Sidebar } from "./Sidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileNavProvider } from "./MobileNavContext";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-accent-50/30">
        <Sidebar />
        <main className="min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </MobileNavProvider>
  );
}
