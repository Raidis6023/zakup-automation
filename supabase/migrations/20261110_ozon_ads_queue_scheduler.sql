-- Frequent Ozon Performance backfill without exceeding the one-live-report quota.
-- The credential is generated and stored in Supabase Vault separately.
-- Never put its plaintext value into SQL migration files or cron.job.
-- CRON_SECRET remains valid for existing Vercel crons.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists(select 1 from vault.secrets where name='ozon_finance_ads_scheduler_v1') then
    raise exception 'Vault credential ozon_finance_ads_scheduler_v1 is required';
  end if;
end $$;
select cron.schedule(
  'ozon_finance_ads_backfill_5min',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url:='https://zakup-automation.vercel.app/api/agents/ozon-finance-ads',
      headers:=jsonb_build_object(
        'Authorization','Bearer '||
        (select decrypted_secret from vault.decrypted_secrets
         where name='ozon_finance_ads_scheduler_v1' limit 1),
        'Accept','application/json'
      ),
      timeout_milliseconds:=290000
    );
  $job$
);
