import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDailySchedule, parseSchedule, validateJobs, minuteKey, dueJobs } from "../infra/scheduler/schedule.mjs";

const original = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;
const migrated = JSON.parse(readFileSync(new URL("../infra/scheduler/jobs.json", import.meta.url), "utf8"));
assert.equal(original.length, 20);
assert.deepEqual(migrated, original, "Schedule must match source before the switch");
const recovery = JSON.parse(readFileSync(new URL("../infra/scheduler/recovery-jobs.json", import.meta.url), "utf8"));
assert.deepEqual(recovery, [
  {path:"/api/agents/ozon-finance-ads",schedule:"*/5 * * * *"},
  {path:"/api/agents/yandex-finance-cron",schedule:"*/10 * * * *"},
  {path:"/api/agents/yandex-finance-campaigns-cron",schedule:"5-59/10 * * * *"},
]);
const jobs = validateJobs([...migrated, ...recovery]);
assert.equal(jobs.length, 23);
assert.deepEqual(parseSchedule("*/5 * * * *"), {kind:"every-minutes",step:5,offset:0});
assert.deepEqual(parseSchedule("5-59/10 * * * *"), {kind:"every-minutes",step:10,offset:5});
assert.deepEqual(parseDailySchedule("0 22 * * *"), { minute: 0, hour: 22 });
assert.throws(() => parseDailySchedule("* * * * *"));
assert.throws(() => parseDailySchedule("60 22 * * *"));
assert.throws(() => validateJobs([...migrated, migrated[0]]));
assert.equal(minuteKey(new Date("2026-11-19T22:00:30Z")), "2026-11-19T22:00");
assert.deepEqual(dueJobs(jobs, new Date("2026-11-19T22:00:00Z")).map(x => x.path),
  ["/api/ozon/daily-sync", "/api/agents/ozon-finance-ads", "/api/agents/yandex-finance-cron"]);
assert.deepEqual(dueJobs(jobs, new Date("2026-11-19T00:00:00Z")).map(x => x.path),
  ["/api/yandex/daily-sync", "/api/agents/ozon-finance-ads", "/api/agents/yandex-finance-cron"]);
assert.deepEqual(dueJobs(jobs, new Date("2026-11-19T00:05:00Z")).map(x => x.path),
  ["/api/agents/ozon-finance-ads", "/api/agents/yandex-finance-campaigns-cron"]);
console.log("PASS: 20 daily + 3 recovery UTC schedules, deduplication and safeguards");
