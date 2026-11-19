-- PANDA read-only schema fingerprint.
-- Compare the output on source and restored database. Never prints rows,
-- passwords, private function bodies or marketplace credentials.
-- Schema changes between snapshots will legitimately change fingerprints.
WITH objects AS (
 SELECT 'tables' AS kind, c.relname::text || '|' || c.relkind::text || '|' ||
  c.relrowsecurity::text || '|' || c.relforcerowsecurity::text AS definition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
 UNION ALL
 SELECT 'columns', table_name||'|'||ordinal_position||'|'||column_name||'|'||
  data_type||'|'||coalesce(udt_name,'')||'|'||is_nullable||'|'||coalesce(column_default,'')
 FROM information_schema.columns WHERE table_schema='public'
 UNION ALL
 SELECT 'constraints', c.conrelid::regclass::text||'|'||c.conname||'|'||pg_get_constraintdef(c.oid)
 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'indexes', indexrelid::regclass::text||'|'||pg_get_indexdef(indexrelid)
 FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'functions', p.proname||'|'||pg_get_function_identity_arguments(p.oid)||'|'||
  md5(pg_get_functiondef(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind IN ('f','p')
 UNION ALL
 SELECT 'policies', tablename||'|'||policyname||'|'||permissive||'|'||
  array_to_string(roles,',')||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')
 FROM pg_policies WHERE schemaname='public'
 UNION ALL
 SELECT 'triggers', tgrelid::regclass::text||'|'||tgname||'|'||pg_get_triggerdef(t.oid)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal
)
SELECT kind,count(*) AS object_count,
  md5(string_agg(definition,E'\n' ORDER BY definition)) AS structure_digest
FROM objects GROUP BY kind ORDER BY kind;
