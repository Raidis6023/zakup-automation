alter table public.ozon_finance_ad_campaign_tasks
 add column if not exists day date;
update public.ozon_finance_ad_campaign_tasks set day=current_date where day is null;
alter table public.ozon_finance_ad_campaign_tasks alter column day set not null;
alter table public.ozon_finance_ad_campaign_tasks
 drop constraint if exists ozon_finance_ad_campaign_tasks_job_id_campaign_id_key;
create unique index if not exists ozon_finance_ad_campaign_day_unique
 on public.ozon_finance_ad_campaign_tasks(job_id,campaign_id,day);
