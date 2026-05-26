import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "cy-eventsystem", template: "%s · cy-eventsystem" },
  description: "Event-based physical inventory tracking",
  // Plan 02-13 RES-04 — PWA manifest. Next 16's Metadata API renders this as
  // <link rel="manifest" href="/manifest.webmanifest"> in <head>. Icons
  // referenced in manifest.webmanifest are placeholders for v1; Lighthouse
  // PWA installability warns until icon-192.png / icon-512.png ship, but the
  // manifest itself satisfies the RES-04 minimum.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "cy-events",
  },
};

export const viewport = {
  // Centralise theme color here (Next 16 deprecates `themeColor` on Metadata
  // in favor of the Viewport export — see node_modules/next/dist/docs/01-app/
  // 03-api-reference/04-functions/generate-viewport.md).
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-svh bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
