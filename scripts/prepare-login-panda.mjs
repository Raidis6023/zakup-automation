import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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


const waitingSource = "public/panda/waiting-panda-source.avif";
const waitingDestination = "public/panda/waiting-panda.webp";
const waitingMeta = await sharp(waitingSource).metadata();
if (!waitingMeta.hasAlpha || (waitingMeta.width ?? 0) < 700 || (waitingMeta.height ?? 0) < 900) {
  throw new Error("Waiting panda source must have a transparent background and sufficient resolution");
}
const waitingOutput = await sharp(waitingSource)
  .webp({ quality: 91, alphaQuality: 100, effort: 6 })
  .toFile(waitingDestination);
if (waitingOutput.size < 12000) throw new Error("Waiting panda output unexpectedly small");
console.log("Waiting panda WebP prepared", waitingOutput.width, waitingOutput.height, waitingOutput.size);


// The original transparent approved mascot is stored as verified base64 parts.
// Reconstruct its optimized AVIF source at build time. No network fetch is needed.
const chunks = await Promise.all(
  Array.from({ length: 6 }, (_, index) =>
    readFile(`public/panda/password-panda-parts/${index}.txt`, "utf8")
  )
);
const approvedAvif = Buffer.from(chunks.join(""), "base64");
const approvedDigest = createHash("sha256").update(approvedAvif).digest("hex");
if (approvedDigest !== "83ac9d45d889f86d09c9470feb0c6a78d386b6a0fcbc3288396a74c17131f919") {
  throw new Error("Approved panda asset did not pass integrity check");
}
await writeFile("public/panda/password-panda-source.avif", approvedAvif);

const passwordSource = "public/panda/password-panda-source.avif";
const passwordDestination = "public/panda/password-panda.webp";
const passwordMetadata = await sharp(passwordSource).metadata();
if (!passwordMetadata.hasAlpha || (passwordMetadata.width ?? 0) < 800 || (passwordMetadata.height ?? 0) < 1000) {
  throw new Error("Approved password panda asset must be transparent and at least 800×1000.");
}
const passwordOutput = await sharp(passwordSource)
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(passwordDestination);
if (passwordOutput.size < 12000) throw new Error("Password panda generated file is unexpectedly small.");
console.log("Password panda WebP prepared", passwordOutput.width, passwordOutput.height, passwordOutput.size);
