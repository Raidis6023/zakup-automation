create table if not exists public.ozon_finance_ad_campaign_tasks (
  id bigserial primary key,
  job_id bigint not null references public.ozon_finance_ad_sync_jobs(id) on delete cascade,
  campaign_id text not null,
  status text not null default 'pending'
    check(status in ('pending','requested','complete','failed')),
  report_uuid text,
  rows_saved integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  unique(job_id,campaign_id)
);
create index if not exists ozon_finance_ad_campaign_tasks_work_idx
 on public.ozon_finance_ad_campaign_tasks(job_id,status,id);
alter table public.ozon_finance_ad_campaign_tasks enable row level security;
revoke all on public.ozon_finance_ad_campaign_tasks from anon,authenticated;
