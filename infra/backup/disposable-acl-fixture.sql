-- Synthetic authorization fixture for disposable CI backup tests.
-- Do not execute on any real Panda database.
DO $panda$
BEGIN
  IF current_database() <> 'postgres' OR
     EXISTS(SELECT 1 FROM pg_class WHERE relname='products' AND relnamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'Refusing to test privileges against a nonempty Panda database';
  END IF;
END;
$panda$;

CREATE ROLE panda_ci_backup_reader NOLOGIN;
CREATE TABLE public.panda_ci_acl_probe (
  id integer PRIMARY KEY,
  marker text NOT NULL
);
INSERT INTO public.panda_ci_acl_probe VALUES (1, 'fixture-only');
GRANT SELECT ON TABLE public.panda_ci_acl_probe TO panda_ci_backup_reader;
