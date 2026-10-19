import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const source = "public/panda/login-panda-approved.avif";
const destination = "public/panda/login-panda-approved.webp";

const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha || metadata.width < 800 || metadata.height < 1000) {
  throw new Error("Approved panda image has invalid dimensions or transparency.");
}

await mkdir(dirname(destination), { recursive: true });
const output = await sharp(source)
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(destination);

if (!output.width || !output.height || output.size < 10000) {
  throw new Error("Failed to prepare approved panda WebP.");
}
console.log("Approved panda asset prepared:", {
  source, destination,
  width: output.width,
  height: output.height,
  size: output.size,
});

const accessSource = "public/panda/access-panda-source.avif";
const accessDestination = "public/panda/access-panda.webp";
const accessMeta = await sharp(accessSource).metadata();
if (!accessMeta.hasAlpha || (accessMeta.width ?? 0) < 650 || (accessMeta.height ?? 0) < 900) {
  throw new Error("Thoughtful panda asset is not a valid transparent high-resolution image.");
}
const accessResult = await sharp(accessSource)
  .webp({ quality: 89, alphaQuality: 100, effort: 6 })
  .toFile(accessDestination);
if (accessResult.size < 12000) throw new Error("Thoughtful panda output unexpectedly small");
console.log("Thoughtful panda WebP prepared", accessResult.width, accessResult.height, accessResult.size);

const blockedSource = "public/panda/blocked-panda-source.avif";
const blockedDestination = "public/panda/blocked-panda.webp";
const blockedMeta = await sharp(blockedSource).metadata();
if (!blockedMeta.hasAlpha || (blockedMeta.width ?? 0) < 800 || (blockedMeta.height ?? 0) < 1000) {
  throw new Error("Blocked panda source must be transparent and high resolution.");
}
const blockedResult = await sharp(blockedSource)
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(blockedDestination);
if (blockedResult.size < 12000) throw new Error("Blocked panda output unexpectedly small");
console.log("Blocked panda WebP prepared", blockedResult.width, blockedResult.height, blockedResult.size);
