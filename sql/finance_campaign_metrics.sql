alter table public.ozon_finance_ad_sku_daily
 add column views bigint check(views>=0),add column clicks bigint check(clicks>=0),
 add column carts bigint check(carts>=0),add column orders bigint check(orders>=0),
 add column revenue_rub numeric(18,4) check(revenue_rub>=0),
 add column metrics_version integer not null default 0;
alter table public.ozon_finance_ad_campaign_tasks add column metrics_ready boolean not null default false;
create table public.yandex_finance_managers(master_key text primary key,manager_name text not null check(length(trim(manager_name)) between 1 and 80),updated_at timestamptz not null default now());
alter table public.yandex_finance_managers enable row level security;
revoke all on public.yandex_finance_managers from anon,authenticated;
grant all on public.yandex_finance_managers to service_role;
insert into public.yandex_finance_managers(master_key,manager_name)
 select distinct coalesce(master_code,'article:'||offer_id),'Ольга' from public.yandex_products on conflict do nothing;