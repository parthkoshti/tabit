import type { Metadata } from "next";
import { appConfig } from "@/app/config";

export const metadata: Metadata = {
  title: "App moved",
  description:
    "The Tab app has moved to a new URL. Continue to the app to split expenses with friends.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "App moved | Tab - Split expenses with friends",
    description:
      "The Tab app has moved to a new URL. Continue to the app to split expenses with friends.",
    url: `${appConfig.appUrl}/app`,
  },
  alternates: {
    canonical: `${appConfig.appUrl}/app`,
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
