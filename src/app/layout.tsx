import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { AppModeProvider } from "@/components/providers/AppModeProvider";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Property Pilot — AI-Powered HOA Inspections",
  description:
    "Upload a neighborhood inspection video and let AI prepare every property review automatically.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <AppModeProvider>{children}</AppModeProvider>
      </body>
    </html>
  );
}
