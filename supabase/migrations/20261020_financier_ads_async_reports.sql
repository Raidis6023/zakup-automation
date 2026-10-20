-- Historical Performance reports are asynchronous. One campaign per CSV
-- lets us consume the official API without ZIP parsing or hidden allocations.
create table if not exists public.ozon_finance_ad_campaign_reports (
 id bigint generated always as identity primary key,
 job_id bigint not null references public.ozon_finance_ad_sync_jobs(id) on delete cascade,
 campaign_id text not null,
 report_uuid text,
 status text not null default 'pending'
   check(status in ('pending','awaiting','complete','failed')),
 row_count integer not null default 0,
 last_error text,
 updated_at timestamptz not null default now(),
 unique(job_id,campaign_id)
);
create index if not exists ozon_finance_ad_reports_status_idx
 on public.ozon_finance_ad_campaign_reports(job_id,status);
alter table public.ozon_finance_ad_campaign_reports enable row level security;
revoke all on public.ozon_finance_ad_campaign_reports from anon,authenticated;