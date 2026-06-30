import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppModeProvider } from "@/components/providers/AppModeProvider";
import { IosHomeScreenIcon } from "@/components/brand/IosHomeScreenIcon";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

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
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <IosHomeScreenIcon />
      </head>
      <body className="font-sans">
        <AppModeProvider>{children}</AppModeProvider>
      </body>
    </html>
  );
}
