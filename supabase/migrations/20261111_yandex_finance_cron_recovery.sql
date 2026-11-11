-- Recover all Yandex Market income, expense and promotion reports.
-- The credential is generated in Supabase Vault and supplied to Vercel as
-- YANDEX_FINANCE_CRON_SECRET. Do not embed the decrypted credential in migrations.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
 if not exists(select 1 from vault.secrets where name='yandex_finance_scheduler_v1') then
  raise exception 'Missing Yandex Finance scheduler credential in Vault';
 end if;
end $$;
select cron.schedule(
 'yandex_finance_recovery_10min','*/10 * * * *',
 $job$
  select net.http_get(
   url:='https://zakup-automation.vercel.app/api/agents/yandex-finance-cron',
   headers:=jsonb_build_object('Authorization','Bearer '||
     (select decrypted_secret from vault.decrypted_secrets
      where name='yandex_finance_scheduler_v1' limit 1),'Accept','application/json'),
   timeout_milliseconds:=290000
  );
 $job$
);
select cron.schedule(
 'yandex_promotion_recovery_10min','5-59/10 * * * *',
 $job$
  select net.http_get(
   url:='https://zakup-automation.vercel.app/api/agents/yandex-finance-campaigns-cron',
   headers:=jsonb_build_object('Authorization','Bearer '||
     (select decrypted_secret from vault.decrypted_secrets
      where name='yandex_finance_scheduler_v1' limit 1),'Accept','application/json'),
   timeout_milliseconds:=290000
  );
 $job$
);
