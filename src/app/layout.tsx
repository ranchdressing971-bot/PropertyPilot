import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { TradeFlowProvider } from "@/components/providers/TradeFlowProvider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TradeFlow — Jobs, invoices, and job profit for HVAC",
  description:
    "Know what got done, who owes you, and what each job made. Built for small HVAC companies.",
  applicationName: "TradeFlow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ecefeb" }],
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${spaceGrotesk.variable} ${plexMono.variable}`}
    >
      <body className="font-sans">
        <TradeFlowProvider>
          <ToastProvider>{children}</ToastProvider>
        </TradeFlowProvider>
      </body>
    </html>
  );
}
