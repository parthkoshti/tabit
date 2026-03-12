import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { Providers } from "./providers";
import { appConfig } from "./config";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.appUrl),
  title: {
    default: appConfig.seo.title,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.seo.description,
  keywords: [
    "Splitwise alternative free",
    "Splitwise alternative",
    "free expense app",
    "split expenses",
    "expense splitting",
    "bill splitting",
    "shared expenses",
    "roommate expenses",
    "trip expenses",
  ],
  authors: [{ name: appConfig.creator.name, url: appConfig.creator.website }],
  creator: appConfig.creator.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appConfig.appUrl,
    siteName: appConfig.name,
    title: appConfig.seo.title,
    description: appConfig.seo.description,
    images: ["/opengraph.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: appConfig.seo.title,
    description: appConfig.seo.description,
    images: ["/opengraph.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: appConfig.appUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans text-foreground">
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <div className="mx-auto w-full max-w-7xl">{children}</div>
              </main>
              <Footer />
            </div>
          </Providers>
          {(process.env.RYBBIT_HOST ||
            process.env.NEXT_PUBLIC_RYBBIT_SCRIPT_URL) &&
          process.env.NEXT_PUBLIC_WEB_RYBBIT_SITE_ID ? (
            <Script
              src={
                process.env.RYBBIT_HOST
                  ? "/api/script.js"
                  : process.env.NEXT_PUBLIC_RYBBIT_SCRIPT_URL!
              }
              data-site-id={process.env.NEXT_PUBLIC_WEB_RYBBIT_SITE_ID}
              strategy="afterInteractive"
            />
          ) : null}
        </body>
      </html>
    </ViewTransitions>
  );
}
