-- Attribution from Performance API for analytics ONLY. Never booked a second time:
-- Seller accruals remain the unique source of charge and operating profit.
create table if not exists public.ozon_finance_ad_sku_daily(
 account_key text not null default 'main',
 day date not null,
 sku text not null,
 campaign_id text not null,
 expense_rub numeric(18,4) not null check(expense_rub>=0),
 synced_at timestamptz not null default now(),
 primary key(account_key,day,sku,campaign_id)
);
create table if not exists public.ozon_finance_ad_coverage(
 account_key text not null default 'main',
 day date not null,
 synced_at timestamptz not null default now(),
 primary key(account_key,day)
);
create table if not exists public.ozon_finance_ad_sync_jobs(
 id bigserial primary key,
 account_key text not null default 'main',
 date_from date not null,
 date_to date not null,
 status text not null default 'pending' check(status in ('pending','running','complete','failed')),
 last_error text,
 updated_at timestamptz not null default now(),
 unique(account_key,date_from,date_to)
);
alter table public.ozon_finance_ad_sku_daily enable row level security;
alter table public.ozon_finance_ad_coverage enable row level security;
alter table public.ozon_finance_ad_sync_jobs enable row level security;
revoke all on public.ozon_finance_ad_sku_daily from anon,authenticated;
revoke all on public.ozon_finance_ad_coverage from anon,authenticated;
revoke all on public.ozon_finance_ad_sync_jobs from anon,authenticated;
create or replace function public.ozon_finance_ad_by_sku(p_from date,p_to date,p_account text default 'main')
returns table(sku text, expense numeric)
language sql stable security invoker set search_path=public as $$
 select a.sku,sum(a.expense_rub)::numeric
 from public.ozon_finance_ad_sku_daily a
 where a.account_key=p_account and a.day between p_from and p_to
 group by a.sku
$$;
revoke all on function public.ozon_finance_ad_by_sku(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_ad_by_sku(date,date,text) to service_role;