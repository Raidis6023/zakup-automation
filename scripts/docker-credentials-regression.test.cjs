"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Every active Ozon feature must read Seller credentials from the same
// admin-managed encrypted store. Do not reintroduce build-time credentials.
const files = [
  "app/api/ozon/daily-sync/route.ts",
  "app/api/ozon-sync-sales/route.ts",
  "app/api/ozon-sync-stocks/route.ts",
  "app/api/ozon/supplies/route.ts",
  "app/api/ozon/fbo-cargoes/route.ts",
  "app/api/ozon/fbo-supply/route.ts",
  "app/api/ozon/fbo-draft/dropoff-options/route.ts",
  "app/api/ozon/fbo-draft/preflight/route.ts",
  "app/api/ozon/fbo-supply-preview/route.ts",
  "app/api/ved-orders/[id]/sync-photos/route.ts",
  "lib/ved-order-photo-sync.ts",
  "lib/ozon-fbo-cargo-auto.ts",
];

for (const file of files) {
  const code = read(file);
  assert.match(code, /getOzonCredentials\s*\(/, file + ": no shared credential reader");
  assert.doesNotMatch(
    code,
    /process\.env\s*\.\s*OZON_(?:CLIENT_ID|API_KEY)\b/,
    file + ": hard-coded Ozon environment credentials remain",
  );
}

const example = read(".env.docker.example");
assert.doesNotMatch(example, /^SUPABASE_SECRET_KEY=/m);
assert.doesNotMatch(example, /^CRON_SECRET=/m);
assert.match(read("lib/integrations/secrets.ts"), /workspace_get_integration_secrets/);
assert.match(read("app/api/admin/integrations/route.ts"), /workspace_upsert_integration_secrets/);
console.log("PASS: Ozon credentials consistently read from admin-managed vault, no runtime secrets in env template");
