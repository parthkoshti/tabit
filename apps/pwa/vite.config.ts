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

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    https,
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
