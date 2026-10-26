-- One persistent global lease for the account's expensive Performance API reports.
-- Never create two simultaneous historical reports for one account.
create table if not exists public.ozon_finance_ad_worker_control(
  account_key text primary key,
  lease_until timestamptz not null default '1970-01-01T00:00:00Z',
  retry_after timestamptz not null default '1970-01-01T00:00:00Z',
  last_phase text,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.ozon_finance_ad_worker_control(account_key)
values('main') on conflict(account_key) do nothing;
alter table public.ozon_finance_ad_worker_control enable row level security;
revoke all on public.ozon_finance_ad_worker_control from anon,authenticated;
alter table public.ozon_finance_ad_campaign_tasks
  add column if not exists date_to date;
update public.ozon_finance_ad_campaign_tasks
  set date_to=day where date_to is null;
alter table public.ozon_finance_ad_campaign_tasks alter column date_to set not null;