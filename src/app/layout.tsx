import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { AppModeProvider } from "@/components/providers/AppModeProvider";
import { IosHomeScreenIcon } from "@/components/brand/IosHomeScreenIcon";
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

/** Transparent primary icon — iOS 18 adapts it for Dark / Tinted appearance. */
const iosAppleIcons: Metadata["icons"] = {
  icon: [
    { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/logo.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [
    {
      url: "/icons/ios/apple-touch-icon-180-transparent.png",
      sizes: "180x180",
      type: "image/png",
    },
  ],
};

export const metadata: Metadata = {
  title: "Property Pilot — AI-Powered HOA Inspections",
  description:
    "Upload a neighborhood inspection video and let AI prepare every property review automatically.",
  manifest: "/manifest.json",
  applicationName: "Property Pilot",
  appleWebApp: {
    capable: true,
    title: "Property Pilot",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/icons/ios/apple-touch-icon-180-transparent.png",
        media: "(device-width: 390px) and (device-height: 844px)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: iosAppleIcons,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1f2e" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <IosHomeScreenIcon />
      </head>
      <body className="font-sans">
        <AppModeProvider>{children}</AppModeProvider>
      </body>
    </html>
  );
}
