import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { RegisterSW } from "./register-sw";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreenLinks } from "./splash-screen-links";
import { appConfig } from "./config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#08090a" },
    { media: "(prefers-color-scheme: dark)", color: "#08090a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
        <head>
          <meta name="apple-mobile-web-app-status-bar-style" />
          <link
            rel="apple-touch-icon"
            href="/icon-192x192.png"
            sizes="192x192"
          />
          <link
            rel="apple-touch-icon-precomposed"
            href="/icon-192x192.png"
            sizes="192x192"
          />
          <SplashScreenLinks />
        </head>
        <body className="min-h-screen bg-background font-sans text-foreground">
          <Providers>
            <RegisterSW />
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
  );
}
