export const appConfig = {
  name: "Tab",
  fullName: "Tab - Split expenses with friends",
  description: "A simple way to split expenses with friends and tabs",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "",
  donateUrl: process.env.NEXT_PUBLIC_DONATE_URL ?? "",
  pwaUrl: process.env.NEXT_PUBLIC_PWA_URL ?? "https://localhost:3003",
  creator: {
    name: "Parth Koshti",
    github: "https://github.com/parthkoshti",
    website: "https://parthkoshti.com",
    otherProjects: [
      { name: "SnitchFeed", url: "https://snitchfeed.com" },
      { name: "Conncord", url: "https://conncord.com" },
    ],
  },
} as const;
