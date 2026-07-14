import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { AppModeProvider } from "@/components/providers/AppModeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { IosHomeScreenIcon } from "@/components/brand/IosHomeScreenIcon";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
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
  title: "RideBy — HOA Drive-Through Inspections",
  description:
    "Upload a neighborhood drive-through. RideBy flags homes that need review so managers can approve notices with confidence.",
  manifest: "/manifest.json",
  applicationName: "RideBy",
  appleWebApp: {
    capable: true,
    title: "RideBy",
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
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f6f3" }],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable}`}>
      <head>
        <IosHomeScreenIcon />
      </head>
      <body className="font-sans">
        <AppModeProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppModeProvider>
      </body>
    </html>
  );
}
