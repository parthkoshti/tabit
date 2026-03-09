import type { MetadataRoute } from "next";
import { appConfig } from "./config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.fullName,
    short_name: appConfig.name,
    description: appConfig.description,
    start_url: appConfig.pwa.startUrl,
    display: appConfig.pwa.display,
    background_color: appConfig.pwa.backgroundColor,
    theme_color: appConfig.pwa.themeColor,
    icons: [
      {
        src: appConfig.icons.sm.src,
        sizes: appConfig.icons.sm.sizes,
        type: "image/png",
      },
      {
        src: appConfig.icons.md.src,
        sizes: appConfig.icons.md.sizes,
        type: "image/png",
      },
      {
        src: appConfig.icons.lg.src,
        sizes: appConfig.icons.lg.sizes,
        type: "image/png",
      },
    ],
  };
}
