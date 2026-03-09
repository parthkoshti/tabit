import type { Metadata } from "next";
import { appConfig } from "@/app/config";

const seoTitle = "Why Tab - Free Splitwise Alternative, No Expense Limits";
const seoDescription =
  "Splitwise added limits and paywalls. Tab is the free alternative: no expense cap, no wait timer, no upgrade prompt. Split bills with friends—forever.";

export const metadata: Metadata = {
  title: {
    absolute: seoTitle,
  },
  description: seoDescription,
  keywords: [
    "Splitwise alternative",
    "free expense app",
    "no expense limits",
    "split bills free",
    "bill splitting app",
    "roommate expenses",
    "trip expenses",
    "free forever",
  ],
  openGraph: {
    type: "article",
    title: seoTitle,
    description: seoDescription,
    url: `${appConfig.appUrl}/why`,
    siteName: appConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
  },
  alternates: {
    canonical: `${appConfig.appUrl}/why`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function WhyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
