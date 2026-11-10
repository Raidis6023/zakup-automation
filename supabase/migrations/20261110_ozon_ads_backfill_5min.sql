-- Speed up the verified historical Ozon advertising importer.
-- The worker enforces a single live provider UUID and retries HTTP 429 with
-- cooldown. This changes cadence only, never source finance data.
do $$
declare old_job bigint;
begin
 select jobid into old_job from cron.job
 where jobname='ozon_finance_ads_backfill_10min';
 if old_job is null then
  raise exception 'Missing protected Ozon advertising cron job';
 end if;
 perform cron.alter_job(old_job,schedule=>'*/5 * * * *');
end $$;
