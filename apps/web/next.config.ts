import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["models", "db"],
  async rewrites() {
    const rewrites: { source: string; destination: string }[] = [
      {
        source: "/api-backend/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
    const rybbitHost = process.env.RYBBIT_HOST;
    if (rybbitHost) {
      rewrites.push(
        {
          source: "/api/script.js",
          destination: `${rybbitHost}/api/script.js`,
        },
        {
          source: "/api/track",
          destination: `${rybbitHost}/api/track`,
        },
      );
    }
    return rewrites;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
