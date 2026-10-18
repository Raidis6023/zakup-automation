-- Explicit actual buyout ledger. Never infer realized sales from order_count.
create table if not exists public.ozon_finance_buyouts_daily(
  account_key text not null default 'main',
  sale_date date not null,
  sku text not null,
  buyout_units integer not null check(buyout_units >= 0),
  return_units integer not null default 0 check(return_units >= 0),
  source text not null check(source in ('realization_report','verified_actual_buyouts')),
  source_reference text,
  inserted_at timestamptz not null default now(),
  primary key(account_key,sale_date,sku,source)
);
create table if not exists public.ozon_finance_buyout_coverage(
  account_key text not null default 'main',
  day date not null,
  source text not null check(source in ('realization_report','verified_actual_buyouts')),
  verified_at timestamptz not null default now(),
  primary key(account_key,day)
);
alter table public.ozon_finance_buyouts_daily enable row level security;
alter table public.ozon_finance_buyout_coverage enable row level security;
revoke all on public.ozon_finance_buyouts_daily from anon,authenticated;
revoke all on public.ozon_finance_buyout_coverage from anon,authenticated;

create or replace function public.ozon_finance_realized_cost(
  p_from date, p_to date, p_account text default 'main'
)
returns table(offer_id text, master_code text, net_buyouts bigint,
  covered_buyouts bigint, cogs_total numeric)
language sql stable security invoker set search_path = public as $$
 with d as (
 select m.offer_id, coalesce(m.master_code,p.master_code) as master_code,
   b.sale_date, sum(b.buyout_units-b.return_units)::bigint as quantity
 from public.ozon_finance_buyouts_daily b
 join public.ozon_finance_buyout_coverage v on v.account_key=b.account_key
   and v.day=b.sale_date and v.source=b.source
 left join public.ozon_finance_sku_map m on m.account_key=b.account_key and m.sku=b.sku
 left join public.products p on p.offer_id=m.offer_id
 where b.account_key=p_account and b.sale_date between p_from and p_to
 group by m.offer_id,coalesce(m.master_code,p.master_code),b.sale_date
 ), cost as (
 select d.*, (select c.unit_cost_rub from public.ozon_finance_costs c
  where c.master_code=d.master_code and c.valid_from<=d.sale_date
  order by c.valid_from desc limit 1) as unit_cost
 from d)
 select c.offer_id,c.master_code,sum(c.quantity)::bigint,
   sum(case when c.unit_cost is null then 0 else c.quantity end)::bigint,
   coalesce(sum(c.quantity*c.unit_cost),0)::numeric
 from cost c
 group by c.offer_id,c.master_code
$$;
revoke all on function public.ozon_finance_realized_cost(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_realized_cost(date,date,text) to service_role;

create or replace function public.ozon_finance_completed_days(p_from date,p_to date,p_account text default 'main')
returns table(day date,record_count integer,synced_at timestamptz)
language sql stable security invoker set search_path=public as $$
 select d.day,d.record_count,d.synced_at
 from public.ozon_finance_sync_days d
 where d.account_key=p_account and d.day between p_from and p_to
 order by d.day
$$;
revoke all on function public.ozon_finance_completed_days(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_completed_days(date,date,text) to service_role;
