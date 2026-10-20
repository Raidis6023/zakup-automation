-- Validated current FBO transit snapshot. Only a complete run is published.
create table if not exists public.ozon_finance_transit_runs(
 run_id uuid primary key default gen_random_uuid(),
 status text not null default 'running' check(status in ('running','complete','failed')),
 cursor text not null default '',
 pages integer not null default 0,
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 last_error text
);
create table if not exists public.ozon_finance_transit_entries(
 run_id uuid not null references public.ozon_finance_transit_runs(run_id),
 posting_number text not null,sku text not null,
 posting_status text not null,quantity integer not null check(quantity>=0),
 unit_price_rub numeric(18,4),primary key(run_id,posting_number,sku)
);
create table if not exists public.ozon_finance_transit_current(
 account_key text primary key default 'main',
 run_id uuid not null references public.ozon_finance_transit_runs(run_id),
 published_at timestamptz not null default now()
);
alter table public.ozon_finance_transit_runs enable row level security;
alter table public.ozon_finance_transit_entries enable row level security;
alter table public.ozon_finance_transit_current enable row level security;
revoke all on public.ozon_finance_transit_runs from anon,authenticated;
revoke all on public.ozon_finance_transit_entries from anon,authenticated;
revoke all on public.ozon_finance_transit_current from anon,authenticated;

create or replace function public.ozon_finance_transit_totals(p_account text default 'main')
returns table(sku text,quantity bigint,open_order_value numeric,as_of timestamptz)
language sql stable security invoker set search_path=public as $$
 select e.sku,sum(e.quantity)::bigint,
  case when count(*) filter(where e.unit_price_rub is null)>0 then null
    else sum(e.quantity * e.unit_price_rub)::numeric end,
  max(a.published_at)
 from public.ozon_finance_transit_current a
 join public.ozon_finance_transit_entries e on e.run_id=a.run_id
 where a.account_key=p_account
 group by e.sku
$$;
revoke all on function public.ozon_finance_transit_totals(text) from public,anon,authenticated;
grant execute on function public.ozon_finance_transit_totals(text) to service_role;
