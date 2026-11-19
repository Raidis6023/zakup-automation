"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const dockerfile = read("Dockerfile");
const compose = read("compose.yaml");
const ignore = read(".dockerignore");
const nextConfig = read("next.config.ts");
const wb = read("app/api/wb/daily-sync/route.ts");
const ym = read("app/api/yandex/daily-sync/route.ts");
const china = read("app/api/china/wb-operational-sales-sync/route.ts");
const internal = read("lib/server/internal-origin.ts");
const registryAlias = read("app/registry/page.tsx");

assert.match(dockerfile, /FROM node:24-bookworm-slim AS deps/);
assert.match(dockerfile, /COPY vendor\/xlsx-0\.20\.3\.tgz/);
assert.match(dockerfile, /RUN npm ci/);
assert.match(dockerfile, /RUN npm run build/);
assert.match(dockerfile, /COPY --from=builder .*\/app\/\.next\/standalone/);
assert.match(dockerfile, /COPY --from=builder .*\/app\/public/);
assert.match(dockerfile, /USER node/);
assert.match(nextConfig, /output: "standalone"/);
assert.match(compose, /127\.0\.0\.1:3000:3000/);
assert.doesNotMatch(compose, /"0\.0\.0\.0:3000:3000"/);
assert.match(compose, /INTERNAL_APP_URL: http:\/\/panda-web:3000/);
assert.match(ignore, /^\.env\*/m);
assert.doesNotMatch(ignore, /^vendor\b/m);

assert.match(internal, /process\.env\.INTERNAL_APP_URL/);
// The alias is a user-authenticated page and cannot be statically rendered.
assert.match(registryAlias, /export const dynamic = "force-dynamic"/);
assert.match(registryAlias, /export const runtime = "nodejs"/);
assert.match(wb, /getInternalAppOrigin\(\)/);
assert.match(ym, /return getInternalAppOrigin\(\)/);
assert.doesNotMatch(wb + ym, /zakup-automation\.vercel\.app/);
assert.doesNotMatch(wb + ym, /VERCEL_PROJECT_PRODUCTION_URL/);
assert.match(china, /getIntegrationSecret\("wb_read_token"\)/);
assert.doesNotMatch(china, /process\.env\.WB_READ_TOKEN/);

const scheduled = JSON.parse(read("vercel.json")).crons;
assert.equal(scheduled.length, 20, "Keep source schedule inventory until separate scheduler is verified");
console.log("PASS: isolated Docker image, internal routing, WB key handling, schedule baseline");
