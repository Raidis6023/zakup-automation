export function parseDailySchedule(value) {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(value);
  if (!match) throw new Error("Only fixed daily UTC schedules are supported");
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute > 59 || hour > 23) throw new Error("Invalid UTC schedule");
  return { minute, hour };
}

export function validateJobs(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) throw new Error("Empty scheduler job list");
  const paths = new Set();
  return jobs.map((job) => {
    if (
      !job || typeof job.path !== "string" ||
      !/^\/api\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/.test(job.path) ||
      typeof job.schedule !== "string" || paths.has(job.path)
    ) throw new Error("Invalid or repeated scheduler route");
    paths.add(job.path);
    return { path: job.path, ...parseDailySchedule(job.schedule) };
  });
}

export function minuteKey(date) {
  return date.toISOString().slice(0, 16);
}

export function dueJobs(jobs, date) {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  return jobs.filter((job) => job.hour === hour && job.minute === minute);
}
