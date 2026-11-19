export function parseDailySchedule(value) {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(value);
  if (!match) throw new Error("Only fixed daily UTC schedules are supported");
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute > 59 || hour > 23) throw new Error("Invalid UTC schedule");
  return { minute, hour };
}

export function parseSchedule(value) {
  if (/^\d{1,2} \d{1,2} \* \* \*$/.test(value)) {
    return { kind: "daily", ...parseDailySchedule(value) };
  }
  const interval = /^\*\/(5|10) \* \* \* \*$/.exec(value);
  if (interval) return { kind: "every-minutes", step: Number(interval[1]), offset: 0 };
  if (value === "5-59/10 * * * *") {
    return { kind: "every-minutes", step: 10, offset: 5 };
  }
  throw new Error("Unsupported UTC cron schedule");
}

export function validateJobs(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) throw new Error("Empty scheduler job list");
  const seen = new Set();
  return jobs.map((job) => {
    if (
      !job || typeof job.path !== "string" ||
      !/^\/api\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/.test(job.path) ||
      typeof job.schedule !== "string"
    ) throw new Error("Invalid scheduler route");
    const uniqueKey = job.path + "|" + job.schedule;
    if (seen.has(uniqueKey)) throw new Error("Duplicate scheduler path and rule");
    seen.add(uniqueKey);
    return { path: job.path, cron: parseSchedule(job.schedule) };
  });
}

export function minuteKey(date) {
  return date.toISOString().slice(0, 16);
}

export function dueJobs(jobs, date) {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const seen = new Set();
  return jobs.filter((job) => {
    const cron = job.cron;
    const due = cron.kind === "daily"
      ? cron.hour === hour && cron.minute === minute
      : minute >= cron.offset && (minute - cron.offset) % cron.step === 0;
    if (!due || seen.has(job.path)) return false;
    seen.add(job.path);
    return true;
  });
}
