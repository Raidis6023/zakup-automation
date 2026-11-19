-- ПАНДА. Выполнять ТОЛЬКО на новой восстановленной PostgreSQL,
-- ПОСЛЕ успешного переноса сотрудников/заметок и разрешения на переключение.
-- НЕ выполнять в действующей облачной базе.
--
-- В отличие от трёх сетевых заданий pg_cron, уведомления являются
-- локальной SQL-задачей и не обращаются к старому Vercel.

DO $panda$
BEGIN
  IF to_regprocedure('public.app_emit_due_reminders()') IS NULL THEN
    RAISE EXCEPTION 'Missing reminder procedure; data/schema restoration incomplete';
  END IF;

  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not initialized';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'app-personal-notes-v1') THEN
    RAISE EXCEPTION 'Reminder task already exists. Review schedule instead of duplicating it.';
  END IF;

  PERFORM cron.schedule(
    'app-personal-notes-v1',
    '* * * * *',
    'select public.app_emit_due_reminders();'
  );
END;
$panda$;

-- Confirm exactly one local reminder job.
SELECT jobname,schedule,active
FROM cron.job WHERE jobname = 'app-personal-notes-v1';
