import { readFileSync } from "node:fs";

for (const name of ["SUPABASE_SECRET_KEY", "CRON_SECRET"]) {
  const file = process.env[name + "_FILE"];
  if (!file) continue;
  const value = readFileSync(file, "utf8").trim();
  if (!value) throw new Error("Empty required secret file: " + name);
  process.env[name] = value;
}

// Import Next.js only after server-only credentials are loaded.
// They must never be present during the public frontend build.
await import("../../server.js");
