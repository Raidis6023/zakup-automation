-- Harmless infrastructure smoke check for a fresh, disposable self-hosted DB.
-- DO NOT treat this as a production backup or migration verification.
DO $panda$
DECLARE
  major integer;
BEGIN
  major := current_setting('server_version_num')::integer / 10000;
  IF major <> 17 THEN
    RAISE EXCEPTION 'Expected PostgreSQL 17, got %', major;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is absent from the selected DB image';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net is absent from the selected DB image';
  END IF;
END;
$panda$;
SELECT 'PASS: PostgreSQL 17 and required cron/net extensions are available' AS status;
