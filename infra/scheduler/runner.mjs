import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validateJobs, minuteKey, dueJobs } from "./schedule.mjs";

const ENABLE_VALUE = "CUTOVER_CONFIRMED";
if (process.env.SCHEDULER_ENABLED !== ENABLE_VALUE) {
  console.error("Panda scheduler disabled: migration cutover was not confirmed");
  process.exit(78);
}

const internalUrl = process.env.INTERNAL_APP_URL?.trim();
if (!internalUrl) throw new Error("INTERNAL_APP_URL is required");
const origin = new URL(internalUrl);
if (origin.protocol !== "http:" || origin.pathname !== "/" ||
    origin.search || origin.hash || origin.username || origin.password) {
  throw new Error("Cron can only access the private internal HTTP service");
}

const secretPath = process.env.CRON_SECRET_FILE || "/run/secrets/cron_secret";
const secret = (await readFile(secretPath, "utf8")).trim();
if (secret.length < 32) throw new Error("Missing or unsafe CRON_SECRET");

const dailyJobs = JSON.parse(await readFile(new URL("./jobs.json", import.meta.url), "utf8"));
const recoveryJobs = JSON.parse(await readFile(new URL("./recovery-jobs.json", import.meta.url), "utf8"));
const jobs = validateJobs([...dailyJobs, ...recoveryJobs]);
const stateDir = process.env.SCHEDULER_STATE_DIR || "/state";
const statePath = join(stateDir, "ledger.json");
await mkdir(stateDir, { recursive: true });
let ledger = {};
try {
  const saved = JSON.parse(await readFile(statePath, "utf8"));
  if (saved && typeof saved === "object" && !Array.isArray(saved)) ledger = saved;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

let lastTick = "";
let ticking = false;
const running = new Set();

async function persist() {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 16);
  for (const key of Object.keys(ledger)) {
    if (key < cutoff) delete ledger[key];
  }
  const temp = statePath + ".tmp";
  await writeFile(temp, JSON.stringify(ledger), { mode: 0o600 });
  await rename(temp, statePath);
}

async function callJob(job, key) {
  const start = Date.now();
  try {
    const response = await fetch(origin.origin + job.path, {
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      signal: AbortSignal.timeout(330_000),
    });
    let logicalSuccess = response.ok;
    // Do not log response bodies, because integrations can contain sensitive data.
    if (response.headers.get("content-type")?.includes("application/json")) {
      const json = await response.json().catch(() => null);
      if (json && json.ok === false) logicalSuccess = false;
    } else {
      await response.body?.cancel();
    }
    console.log(JSON.stringify({
      event: "job_finished", minute: key, path: job.path,
      httpStatus: response.status, ok: logicalSuccess,
      durationMs: Date.now() - start,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "job_error", minute: key, path: job.path,
      type: error instanceof Error ? error.name : "UnknownError",
    }));
  } finally {
    running.delete(job.path);
  }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = new Date();
    const key = minuteKey(now);
    if (key === lastTick) return;
    const matches = dueJobs(jobs, now);
    for (const job of matches) {
      if (running.has(job.path) || ledger[key]?.includes(job.path)) continue;
      ledger[key] = [...(ledger[key] ?? []), job.path];
      // Persist BEFORE a request to avoid duplicate executions after restart.
      // If the process dies after recording but before sending, manual
      // recovery is necessary; never replay jobs silently.
      await persist();
      running.add(job.path);
      void callJob(job, key);
    }
    lastTick = key;
  } catch (error) {
    console.error("Scheduler tick failed", error instanceof Error ? error.message : "Unknown");
  } finally {
    ticking = false;
  }
}

console.log(JSON.stringify({
  event: "scheduler_started", jobs: jobs.length, timezone: "UTC",
  privateOrigin: origin.origin,
}));
await tick();
setInterval(() => { void tick(); }, 10_000);
