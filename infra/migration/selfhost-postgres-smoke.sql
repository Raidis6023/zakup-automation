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
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'supabase_vault') THEN
    RAISE EXCEPTION 'supabase_vault is absent: admin-managed marketplace keys cannot be restored';
  END IF;
END;
$panda$;
SELECT 'PASS: PostgreSQL 17, pg_cron, pg_net and supabase_vault are available' AS status;
