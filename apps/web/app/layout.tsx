import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { Providers } from "./providers";
import { RegisterSW } from "./register-sw";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreenLinks } from "./splash-screen-links";
import { appConfig } from "./config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: appConfig.fullName,
  description: appConfig.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" className={`dark ${inter.variable}`}>
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" />
          <link
            rel="apple-touch-icon"
            href="/apple-touch-icon.png"
            sizes="192x192"
          />
          <link
            rel="apple-touch-icon-precomposed"
            href="/apple-touch-icon-precomposed.png"
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
    </ViewTransitions>
  );
}
