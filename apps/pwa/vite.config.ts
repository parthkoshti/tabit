import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";

const certDir = path.resolve(__dirname, "../../certs");
const https =
  fs.existsSync(path.join(certDir, "cert.pem")) &&
  fs.existsSync(path.join(certDir, "key.pem"))
    ? {
        cert: fs.readFileSync(path.join(certDir, "cert.pem")),
        key: fs.readFileSync(path.join(certDir, "key.pem")),
      }
    : undefined;

const isProd = process.env.NODE_ENV === "production";
const useDevProxy = !process.env.VITE_API_URL;

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
) as { version: string };

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
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
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
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/rpc/],
      },
      includeAssets: ["favicon.ico", "icon-192x192.png", "icon-512x512.png", "offline.html"],
    }),
  ],
  resolve: {
    conditions: ["source"],
    alias: {
      "@": path.resolve(__dirname, "."),
      shared: path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  preview: {
    allowedHosts: getAllowedHosts(),
  },
  server: {
    https: isProd ? undefined : https,
    proxy: useDevProxy
      ? {
          "/rpc": {
            target: "http://localhost:3001",
            changeOrigin: true,
          },
          "/api/auth": {
            target: "http://localhost:3001",
            changeOrigin: true,
          },
        }
      : undefined,
  },
  optimizeDeps: {
    exclude: ["shared", "models", "services", "rpc"],
  },
});
