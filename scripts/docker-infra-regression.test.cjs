"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const upstream = read("infra/supabase/prepare.sh");
const overlay = read("infra/supabase/docker-compose.panda.yml");
const app = read("compose.server.yaml");
const cron = read("compose.scheduler.yaml");
const schedule = read("infra/scheduler/runner.mjs");
const reverseProxy = read("infra/nginx/panda.conf.example");
const runtime = read("infra/docker/entrypoint.mjs");
const serverFetch = read("lib/supabase/server-fetch.ts");
const dockerIgnore = read(".dockerignore");

assert.match(upstream, /self-hosted\/v0\.8\.4/);
assert.match(upstream, /sparse-checkout set docker/);
assert.match(upstream, /Destination already exists; refusing to overwrite/);
assert.doesNotMatch(upstream, /sh run\.sh start|docker compose up/);

assert.match(overlay, /api-gw:/);
assert.match(overlay, /supavisor:/);
assert.equal((overlay.match(/ports: !override/g) ?? []).length, 2);
for (const port of ["8000", "5432", "6543"])
  assert.match(overlay, new RegExp("127\\.0\\.0\\.1:" + port + ":" + port));

assert.match(app, /SUPABASE_INTERNAL_URL: http:\/\/supabase-gateway:8000/);
assert.match(app, /SUPABASE_SECRET_KEY_FILE: \/run\/secrets\/supabase_secret_key/);
assert.match(app, /CRON_SECRET_FILE: \/run\/secrets\/cron_secret/);
assert.match(runtime, /readFileSync\(file, "utf8"\)/);
assert.match(runtime, /await import\("\.\.\/\.\.\/server\.js"\)/);
assert.match(serverFetch, /privateOrigin/);
assert.match(serverFetch, /new Request\(internalUrl, input\)/);
for (const file of [
  "lib/supabase/admin.ts",
  "lib/supabase/server.ts",
  "lib/supabase/proxy.ts",
]) assert.match(read(file), /getServerSupabaseFetch/);

assert.match(cron, /profiles: \["cutover"\]/);
assert.match(cron, /SCHEDULER_ENABLED/);
assert.match(cron, /CRON_SECRET_FILE/);
assert.match(schedule, /CUTOVER_CONFIRMED/);
assert.match(schedule, /Persist BEFORE a request/);
assert.doesNotMatch(cron, /ports:/);

assert.match(reverseProxy, /listen 443 ssl/);
assert.match(reverseProxy, /127\.0\.0\.1:3000/);
assert.match(reverseProxy, /127\.0\.0\.1:8000/);
assert.doesNotMatch(reverseProxy, /listen 8000/);

for (const token of [".panda-local", ".ci-secrets", "secrets", ".env*"])
  assert.ok(dockerIgnore.includes(token), "Build context does not exclude " + token);

console.log("PASS: official self-host overlay, loopback-only ports, secret mounts, disabled cron, local HTTPS proxy");
