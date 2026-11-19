import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDailySchedule, validateJobs, minuteKey, dueJobs } from "../infra/scheduler/schedule.mjs";

const original = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;
const migrated = JSON.parse(readFileSync(new URL("../infra/scheduler/jobs.json", import.meta.url), "utf8"));
assert.equal(original.length, 20);
assert.deepEqual(migrated, original, "Schedule must match source before the switch");
const jobs = validateJobs(migrated);
assert.equal(jobs.length, 20);
assert.deepEqual(parseDailySchedule("0 22 * * *"), { minute: 0, hour: 22 });
assert.throws(() => parseDailySchedule("* * * * *"));
assert.throws(() => parseDailySchedule("60 22 * * *"));
assert.throws(() => validateJobs([...migrated, migrated[0]]));
assert.equal(minuteKey(new Date("2026-11-19T22:00:30Z")), "2026-11-19T22:00");
assert.deepEqual(dueJobs(jobs, new Date("2026-11-19T22:00:00Z")).map(x => x.path),
  ["/api/ozon/daily-sync"]);
assert.deepEqual(dueJobs(jobs, new Date("2026-11-19T00:00:00Z")).map(x => x.path),
  ["/api/yandex/daily-sync"]);
console.log("PASS: 20 UTC tasks migrated exactly, cron parser and safeguards");
