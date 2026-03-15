import type { Metadata } from "next";
import { appConfig } from "@/app/config";

export const metadata: Metadata = {
  title: {
    absolute: `Blog | ${appConfig.name}`,
  },
  description:
    "Updates, tips, and stories from the Tab team. Learn about expense splitting, new features, and our mission to keep splitting bills free.",
  openGraph: {
    type: "website",
    title: `Blog | ${appConfig.name}`,
    description:
      "Updates, tips, and stories from the Tab team. Learn about expense splitting, new features, and our mission to keep splitting bills free.",
    url: `${appConfig.appUrl}/blog`,
    siteName: appConfig.name,
  },
  alternates: {
    canonical: `${appConfig.appUrl}/blog`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
