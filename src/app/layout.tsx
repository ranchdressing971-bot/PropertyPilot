import type { Metadata, Viewport } from "next";
import { Manrope, Outfit } from "next/font/google";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { TradeFlowProvider } from "@/components/providers/TradeFlowProvider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TradeFlow — HVAC jobs, invoices, and profit",
  description:
    "Know what got done, who owes you, and what each job made. TradeFlow helps small HVAC companies manage customers, jobs, invoices, and profitability.",
  applicationName: "TradeFlow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f6f9" }],
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${outfit.variable}`}>
      <body className="font-sans">
        <TradeFlowProvider>
          <ToastProvider>{children}</ToastProvider>
        </TradeFlowProvider>
      </body>
    </html>
  );
}
