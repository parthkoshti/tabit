#!/usr/bin/env node
/**
 * Generate HTTPS certs for local dev (web + pwa) including your network IP.
 * Requires mkcert: brew install mkcert && mkcert -install
 *
 * Run: pnpm generate-https-certs
 * Or: LOCAL_IP=192.168.0.120 node scripts/generate-https-certs.js
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const webCertDir = path.join(rootDir, "apps/web/certificates");
const pwaCertDir = path.join(rootDir, "apps/pwa/certificates");
const webKeyPath = path.join(webCertDir, "key.pem");
const webCertPath = path.join(webCertDir, "cert.pem");

function getLocalIP() {
  if (process.env.LOCAL_IP) return process.env.LOCAL_IP;
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === "IPv4") return addr.address;
    }
  }
  return null;
}

function main() {
  const mkcert = spawnSync("mkcert", ["-help"], { encoding: "utf8" });
  if (mkcert.status !== 0) {
    console.error("mkcert not found. Install it first:");
    console.error("  macOS: brew install mkcert && mkcert -install");
    console.error("  Linux: apt install mkcert / dnf install mkcert");
    process.exit(1);
  }

  const names = ["localhost", "127.0.0.1", "::1"];
  const localIP = getLocalIP();
  if (localIP) {
    names.push(localIP);
    console.log(`Including network IP: ${localIP}`);
  } else {
    console.log("Could not detect local IP. Use LOCAL_IP=192.168.0.120 if needed.");
  }

  if (!fs.existsSync(webCertDir)) fs.mkdirSync(webCertDir, { recursive: true });

  console.log("Generating certificates for web...");
  const result = spawnSync(
    "mkcert",
    ["-key-file", webKeyPath, "-cert-file", webCertPath, ...names],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.error("Failed to generate certificates.");
    process.exit(1);
  }

  if (!fs.existsSync(pwaCertDir)) fs.mkdirSync(pwaCertDir, { recursive: true });
  fs.copyFileSync(webKeyPath, path.join(pwaCertDir, "localhost-key.pem"));
  fs.copyFileSync(webCertPath, path.join(pwaCertDir, "localhost.pem"));

  console.log("Done. Certs saved to apps/web/certificates/ and apps/pwa/certificates/");
}

main();
