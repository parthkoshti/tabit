export const appConfig = {
  name: "Tab",
  fullName: "Tab - Split expenses with friends",
  description: "A simple way to split expenses with friends and tabs",
  githubUrl: import.meta.env.NEXT_PUBLIC_GITHUB_URL ?? "",
  donateUrl: import.meta.env.NEXT_PUBLIC_DONATE_URL ?? "",
  icons: {
    sm: { src: "/icon-192x192.png", sizes: "192x192" },
    md: { src: "/icon-512x512.png", sizes: "512x512" },
    lg: { src: "/icon-1024x1024.png", sizes: "1024x1024" },
  },
  pwa: {
    startUrl: "/",
    display: "standalone" as const,
    backgroundColor: "#08090a",
    themeColor: "#08090a",
  },
} as const;
