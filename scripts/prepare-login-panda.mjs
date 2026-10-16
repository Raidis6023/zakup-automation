import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const input = "public/panda/login-panda.webp";
const output = "public/panda/login-panda-hq.webp";

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const width = info.width;
const height = info.height;
const channels = info.channels;

if (channels !== 4 || width < 100 || height < 100) {
  throw new Error("Login panda source is missing or invalid.");
}

const original = Buffer.from(data);
const cleaned = Buffer.from(original);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const idx = (y * width + x) * channels;
    const a = original[idx + 3];
    if (a <= 16) {
      cleaned[idx + 3] = 0;
      continue;
    }
    if (a >= 253) continue;
    const newAlpha = Math.max(0, Math.min(255, Math.round((a - 16) * 255 / 239)));
    cleaned[idx + 3] = newAlpha;

    // Replace backdrop-tinted fringe RGB with nearby actual character pixels.
    if (newAlpha > 0 && a < 236) {
      let nearest = -1;
      let best = Number.POSITIVE_INFINITY;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const other = (ny * width + nx) * channels;
          if (original[other + 3] < 245) continue;
          const score = dx * dx + dy * dy;
          if (score < best) { nearest = other; best = score; }
        }
      }
      if (nearest >= 0) {
        for (let k = 0; k < 3; k += 1) cleaned[idx + k] = original[nearest + k];
      }
    }
  }
}

await mkdir(dirname(output), { recursive: true });
await sharp(cleaned, {
  raw: { width, height, channels: 4 },
})
  .resize({ width: 820, kernel: "lanczos3" })
  .sharpen({ sigma: 0.8 })
  .webp({ quality: 89, alphaQuality: 95, effort: 6 })
  .toFile(output);
console.log("Prepared panda asset:", input, "->", output, "(820px)");
