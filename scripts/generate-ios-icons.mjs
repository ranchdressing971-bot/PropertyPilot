/**
 * Generates iOS-ready icons: logo centered on light/dark canvas backgrounds.
 * Does NOT overwrite public/logo.png (source artwork).
 * Run: node scripts/generate-ios-icons.mjs
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "public/logo.png");

const LIGHT_BG = { r: 246, g: 244, b: 240, alpha: 1 }; // #f6f4f0
const DARK_BG = { r: 26, g: 31, b: 46, alpha: 1 }; // #1a1f2e

async function makeIcon(size, bg, outPath) {
  const logoSize = Math.round(size * 0.82);
  const logo = await sharp(source).resize(logoSize, logoSize, { fit: "contain" }).png().toBuffer();
  const offset = Math.round((size - logoSize) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

const iosDir = path.join(root, "public/icons/ios");
await mkdir(iosDir, { recursive: true });

const sizes = [120, 152, 167, 180, 512];

for (const size of sizes) {
  await makeIcon(size, LIGHT_BG, path.join(iosDir, `apple-touch-icon-${size}.png`));
  await makeIcon(size, DARK_BG, path.join(iosDir, `apple-touch-icon-${size}-dark.png`));
}

await makeIcon(512, LIGHT_BG, path.join(iosDir, "icon-512.png"));
await makeIcon(512, DARK_BG, path.join(iosDir, "icon-512-dark.png"));

// Root paths iOS Safari probes first (no media queries — one icon per URL)
await makeIcon(180, LIGHT_BG, path.join(root, "public/apple-touch-icon.png"));
await makeIcon(180, DARK_BG, path.join(root, "public/apple-touch-icon-dark.png"));
await makeIcon(32, LIGHT_BG, path.join(root, "public/favicon-32.png"));

// Dark-mode web logo (homepage); keep public/logo.png as the light source
await makeIcon(512, DARK_BG, path.join(root, "public/logo-dark.png"));

// Next.js App Router file-based icons (most reliable for Add to Home Screen)
const appDir = path.join(root, "src/app");
await makeIcon(180, LIGHT_BG, path.join(appDir, "apple-icon.png"));
await makeIcon(32, LIGHT_BG, path.join(appDir, "icon.png"));

console.log("iOS icons generated (logo.png unchanged).");
