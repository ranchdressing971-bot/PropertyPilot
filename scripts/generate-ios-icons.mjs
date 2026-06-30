/**
 * Generates iOS home screen icons.
 *
 * iOS 18+ adapts icons (dark / clear / tinted) when the PNG has a transparent
 * background — same as Google Maps and other PWAs. Solid backgrounds block that.
 *
 * Run: npm run generate:icons
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
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Strip near-white pixels so iOS can supply its own adaptive background. */
async function logoWithoutWhiteBg() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 235 && g > 235 && b > 235) {
      data[i + 3] = 0;
    }
  }

  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function makeSolidIcon(size, bg, outPath) {
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

/** Transparent canvas — iOS 18 applies light/dark/tinted treatment automatically. */
async function makeTransparentIcon(size, logoPng, outPath) {
  const logoSize = Math.round(size * 0.78);
  const logo = await sharp(logoPng)
    .resize(logoSize, logoSize, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  const offset = Math.round((size - logoSize) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

const logoPng = await logoWithoutWhiteBg();
const iosDir = path.join(root, "public/icons/ios");
await mkdir(iosDir, { recursive: true });

const sizes = [120, 152, 167, 180, 512];

for (const size of sizes) {
  await makeSolidIcon(size, LIGHT_BG, path.join(iosDir, `apple-touch-icon-${size}.png`));
  await makeSolidIcon(size, DARK_BG, path.join(iosDir, `apple-touch-icon-${size}-dark.png`));
  await makeTransparentIcon(
    size,
    logoPng,
    path.join(iosDir, `apple-touch-icon-${size}-transparent.png`)
  );
}

await makeSolidIcon(512, LIGHT_BG, path.join(iosDir, "icon-512.png"));
await makeSolidIcon(512, DARK_BG, path.join(iosDir, "icon-512-dark.png"));
await makeTransparentIcon(512, logoPng, path.join(iosDir, "icon-512-transparent.png"));

// Primary home screen icon — transparent so iOS 18 can adapt appearance
await makeTransparentIcon(180, logoPng, path.join(root, "public/apple-touch-icon.png"));
await makeSolidIcon(180, DARK_BG, path.join(root, "public/apple-touch-icon-dark.png"));
await makeSolidIcon(180, LIGHT_BG, path.join(root, "public/apple-touch-icon-light.png"));
await makeSolidIcon(32, LIGHT_BG, path.join(root, "public/favicon-32.png"));

// Dark-mode web logo (homepage in Safari)
await makeSolidIcon(512, DARK_BG, path.join(root, "public/logo-dark.png"));

// Next.js file-based icons — transparent apple icon for iOS adaptive treatment
const appDir = path.join(root, "src/app");
await makeTransparentIcon(180, logoPng, path.join(appDir, "apple-icon.png"));
await makeSolidIcon(32, LIGHT_BG, path.join(appDir, "icon.png"));

console.log("iOS icons generated (transparent primary for adaptive home screen).");
