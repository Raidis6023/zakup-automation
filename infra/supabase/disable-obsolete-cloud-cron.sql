-- PАНДА: RUN ONLY on a newly restored SELF-HOSTED Supabase database.
-- DO NOT run on production cloud project.
--
-- After restoring a copy of PostgreSQL and BEFORE allowing outbound network
-- traffic or enabling the new scheduler, remove precisely these old database
-- HTTP cron jobs that still target zakup-automation.vercel.app.
-- Preserve app-personal-notes-v1: it is a local SQL job.
-- Requires privileges to edit cron.job and extension pg_cron.
--
-- Review targets before executing:
-- SELECT jobid, jobname, schedule FROM cron.job WHERE active;

DO $panda$
DECLARE
  job_record record;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname
      FROM cron.job
     WHERE jobname IN (
       'ozon_finance_ads_backfill_10min',
       'yandex_finance_recovery_10min',
       'yandex_promotion_recovery_10min'
     )
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Removed obsolete cloud-targeting cron job: %', job_record.jobname;
  END LOOP;
END;
$panda$;

-- Verify no active SQL cron still includes the old deployment hostname.
SELECT jobname, schedule, active,
       position('vercel.app' in command) > 0 AS references_old_host
  FROM cron.job
 WHERE active
 ORDER BY jobname;
