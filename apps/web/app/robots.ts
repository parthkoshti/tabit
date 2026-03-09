import type { MetadataRoute } from "next";
import { appConfig } from "./config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/invite"],
    },
    sitemap: `${appConfig.appUrl}/sitemap.xml`,
  };
}
