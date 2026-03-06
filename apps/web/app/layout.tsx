import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { RegisterSW } from "./register-sw";

export const metadata: Metadata = {
  title: "Tabit - Split expenses with friends",
  description: "A simple way to split expenses with friends and groups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <RegisterSW />
          {children}
        </Providers>
      </body>
    </html>
  );
}
