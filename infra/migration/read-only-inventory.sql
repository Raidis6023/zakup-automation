-- PANDA: read-only migration inventory.
-- Safe to run in source or target with psql.
-- Does not read PII, token values, passwords, Vault data or individual files.
-- Do not run migrations/dumps until this comparison is reviewed.

SELECT
  current_database() AS database_name,
  current_setting('server_version') AS postgres_version,
  pg_database_size(current_database()) AS database_bytes,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS public_tables,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity) AS public_rls_tables,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_rls_policies,
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM storage.buckets) AS storage_buckets,
  (SELECT count(*) FROM storage.objects) AS storage_objects;

SELECT b.id AS bucket_id, b.public, count(o.id) AS object_count,
  coalesce(sum(case when (o.metadata->>'size') ~ '^[0-9]+$'
    then (o.metadata->>'size')::bigint else 0 end),0) AS declared_bytes
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id=b.id
GROUP BY b.id,b.public ORDER BY b.id;

SELECT extname,extversion FROM pg_extension
WHERE extname IN ('pg_cron','pg_net','pgcrypto','uuid-ossp','pgsodium')
ORDER BY extname;

-- NEVER print commands from cron.job: they can contain embedded credentials.
SELECT jobname,schedule,active,
  (position('vercel.app' in command)>0) AS references_old_vercel
FROM cron.job
ORDER BY jobname;

SELECT p.proname AS function_name,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS signed_in_can_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS backend_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('workspace_get_integration_secrets','workspace_upsert_integration_secrets')
ORDER BY p.proname;
