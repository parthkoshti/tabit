import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  const pwaUrl = process.env.VITE_PWA_URL;
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
  plugins: [react()],
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
