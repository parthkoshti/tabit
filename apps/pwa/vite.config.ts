import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";

const certDir = path.resolve(__dirname, "certificates");
const https =
  fs.existsSync(path.join(certDir, "localhost.pem")) &&
  fs.existsSync(path.join(certDir, "localhost-key.pem"))
    ? {
        cert: fs.readFileSync(path.join(certDir, "localhost.pem")),
        key: fs.readFileSync(path.join(certDir, "localhost-key.pem")),
      }
    : undefined;

const isProd = process.env.NODE_ENV === "production";

function getAllowedHosts(): string[] {
  const hosts = ["localhost"];
  const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL;
  if (pwaUrl) {
    try {
      const host = new URL(pwaUrl).hostname;
      if (!hosts.includes(host)) hosts.push(host);
    } catch {
      // ignore invalid URL
    }
  }
  return hosts;
}

export default defineConfig({
  envPrefix: ["NEXT_PUBLIC_", "VITE_"],
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      registerType: "prompt",
      injectRegister: null,
      srcDir: "src",
      filename: "sw.ts",
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "/index.html",
      },
      manifest: {
        name: "Tab - Split expenses with friends",
        short_name: "Tab",
        description: "A simple way to split expenses with friends and tabs",
        start_url: "/",
        display: "standalone",
        background_color: "#08090a",
        theme_color: "#08090a",
        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-1024x1024.png", sizes: "1024x1024", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api-backend/, /^\/api\/auth/],
      },
      includeAssets: ["favicon.ico", "icon-192x192.png", "icon-512x512.png", "offline.html"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  preview: {
    allowedHosts: getAllowedHosts(),
  },
  server: {
    https: isProd ? undefined : https,
    proxy: {
      "/api-backend": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-backend/, ""),
      },
      "/api/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["auth", "data", "models", "shared"],
  },
});
