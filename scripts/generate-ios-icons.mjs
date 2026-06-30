/**
 * Generates iOS home screen icons.
 *
 * iOS 18+ adapts transparent icons for light/dark/tinted home screens.
 * We trim outer padding, enlarge the mark, and brighten navy tones while
 * keeping the white house interior so it reads on dark backgrounds.
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

const LIGHT_BG = { r: 246, g: 244, b: 240, alpha: 1 };
const DARK_BG = { r: 26, g: 31, b: 46, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Flood-fill edge-connected white to transparent; keeps enclosed white (house). */
async function removeOuterWhite(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const visited = new Uint8Array(w * h);
  const queue = [];

  const isWhite = (pi) => data[pi] > 228 && data[pi + 1] > 228 && data[pi + 2] > 228;

  function push(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const pi = idx * 4;
    if (!isWhite(pi)) return;
    visited[idx] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const pi = (y * w + x) * 4;
    data[pi + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return sharp(Buffer.from(data), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Trim, drop outer white, brighten navy for dark home screens. */
async function prepareLogoPng({ brightenDark = false, adaptive = false } = {}) {
  let png = await sharp(source).trim({ threshold: 12 }).png().toBuffer();

  if (adaptive) {
    png = await removeOuterWhite(png);
  }

  if (!brightenDark) {
    return png;
  }

  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Keep white house / highlights; lift only the dark navy P
    if (lum < 90 && !(r > 200 && g > 200 && b > 200)) {
      data[i] = Math.min(255, r + 45);
      data[i + 1] = Math.min(255, g + 85);
      data[i + 2] = Math.min(255, b + 140);
    }
  }

  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function compositeOnCanvas(size, logoPng, background, outPath) {
  const logoSize = Math.round(size * 0.96);
  const logo = await sharp(logoPng)
    .resize(logoSize, logoSize, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.round((size - meta.width) / 2);
  const top = Math.round((size - meta.height) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath);
}

const logoStandard = await prepareLogoPng({ brightenDark: false, adaptive: false });
const logoAdaptive = await prepareLogoPng({ brightenDark: true, adaptive: true });

const iosDir = path.join(root, "public/icons/ios");
await mkdir(iosDir, { recursive: true });

const sizes = [120, 152, 167, 180, 512];

for (const size of sizes) {
  await compositeOnCanvas(size, logoStandard, LIGHT_BG, path.join(iosDir, `apple-touch-icon-${size}.png`));
  await compositeOnCanvas(size, logoStandard, DARK_BG, path.join(iosDir, `apple-touch-icon-${size}-dark.png`));
  await compositeOnCanvas(
    size,
    logoAdaptive,
    TRANSPARENT,
    path.join(iosDir, `apple-touch-icon-${size}-transparent.png`)
  );
}

await compositeOnCanvas(512, logoStandard, LIGHT_BG, path.join(iosDir, "icon-512.png"));
await compositeOnCanvas(512, logoStandard, DARK_BG, path.join(iosDir, "icon-512-dark.png"));
await compositeOnCanvas(512, logoAdaptive, TRANSPARENT, path.join(iosDir, "icon-512-transparent.png"));

await compositeOnCanvas(180, logoAdaptive, TRANSPARENT, path.join(root, "public/apple-touch-icon.png"));
await compositeOnCanvas(180, logoStandard, DARK_BG, path.join(root, "public/apple-touch-icon-dark.png"));
await compositeOnCanvas(180, logoStandard, LIGHT_BG, path.join(root, "public/apple-touch-icon-light.png"));
await compositeOnCanvas(32, logoStandard, LIGHT_BG, path.join(root, "public/favicon-32.png"));
await compositeOnCanvas(512, logoStandard, DARK_BG, path.join(root, "public/logo-dark.png"));

const appDir = path.join(root, "src/app");
await compositeOnCanvas(180, logoAdaptive, TRANSPARENT, path.join(appDir, "apple-icon.png"));
await compositeOnCanvas(32, logoStandard, LIGHT_BG, path.join(appDir, "icon.png"));

const trimmedMeta = await sharp(logoStandard).metadata();
console.log(
  `iOS icons generated — trimmed ${trimmedMeta.width}x${trimmedMeta.height}, 96% canvas fill.`
);
