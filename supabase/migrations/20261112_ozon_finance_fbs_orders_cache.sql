-- Store ONLY sanitized FBS status summaries; never keep buyer data.
-- Loaded on request from the supported /v4/posting/fbs/list method and
-- refreshed after a short TTL, because cancellation status changes.
create table if not exists public.ozon_finance_fbs_order_cache(
 account_key text not null default 'main',
 date_from date not null,
 date_to date not null,
 synced_at timestamptz not null default now(),
 rows jsonb not null default '[]'::jsonb,
 primary key(account_key,date_from,date_to),
 constraint ozon_fbs_cache_rows_array check(jsonb_typeof(rows)='array')
);
alter table public.ozon_finance_fbs_order_cache enable row level security;
revoke all on public.ozon_finance_fbs_order_cache from public,anon,authenticated;
grant all on public.ozon_finance_fbs_order_cache to service_role;
