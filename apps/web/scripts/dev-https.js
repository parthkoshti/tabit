#!/usr/bin/env node
/**
 * Start Next.js dev with HTTPS. Uses mkcert-generated certs (including network IP)
 * when available; otherwise falls back to Next.js default (localhost only).
 *
 * Generate network certs: pnpm generate-https-certs
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const certDir = path.join(__dirname, "../certificates");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");

const hasCustomCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

const args = [
  "next",
  "dev",
  "--turbopack",
  "--experimental-https",
  ...(hasCustomCerts
    ? [
        "--experimental-https-key",
        keyPath,
        "--experimental-https-cert",
        certPath,
      ]
    : []),
];

if (hasCustomCerts) {
  console.log("Using custom certs (includes network IP)");
} else {
  console.log("Using localhost certs only. For 192.168.x.x access: pnpm generate-https-certs (requires mkcert)");
}

const dotenvBin =
  fs.existsSync(path.join(__dirname, "../node_modules/.bin/dotenv"))
    ? path.join(__dirname, "../node_modules/.bin/dotenv")
    : path.join(__dirname, "../../../node_modules/.bin/dotenv");
const child = spawn(dotenvBin, ["-e", "../../.env", "-e", "../../.env.local", "--", ...args], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});

child.on("exit", (code) => process.exit(code ?? 0));
