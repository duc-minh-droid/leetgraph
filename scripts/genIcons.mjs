// Renders public/logo.svg into the PNG icon set required for PWA installs.
// Usage: node scripts/genIcons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/logo.svg");
const BG = "#FFFDF5";

async function icon(size, out, { pad = 0 } = {}) {
  const inner = size - pad * 2;
  const rendered = await sharp(svg, { density: 300 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: rendered, left: pad, top: pad }])
    .png()
    .toFile(`public/${out}`);
  console.log("wrote", out);
}

await icon(192, "pwa-192.png");
await icon(512, "pwa-512.png");
// Maskable needs a safe zone: logo at ~65% with background fill.
await icon(512, "pwa-maskable-512.png", { pad: 90 });
await icon(180, "apple-touch-icon.png", { pad: 14 });
