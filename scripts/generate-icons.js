/**
 * Generates placeholder PWA icons. Run: node scripts/generate-icons.js
 * Replace with proper icons before production.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [192, 512];
const publicDir = path.join(__dirname, "../apps/web/public");

async function generate() {
  for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;
    const filepath = path.join(publicDir, filename);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 },
      },
    })
      .png()
      .toFile(filepath);
    console.log(`Created ${filename} (placeholder - replace with proper icon)`);
  }
}

generate().catch(console.error);
