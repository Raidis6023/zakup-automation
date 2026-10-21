-- Only a completely paginated snapshot of actual cross-dock supplies is visible.
create table if not exists public.ozon_finance_crossdock_runs(
 run_id uuid primary key default gen_random_uuid(),
 status text not null default 'running' check(status in ('running','complete','failed')),
 last_id text not null default '',pages integer not null default 0,
 started_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 completed_at timestamptz,last_error text
);
create table if not exists public.ozon_finance_crossdock_items(
 run_id uuid not null references public.ozon_finance_crossdock_runs(run_id),
 supply_id text not null,sku text not null,
 destination_warehouse text,quantity integer not null check(quantity>=0),
 primary key(run_id,supply_id,sku)
);
create table if not exists public.ozon_finance_crossdock_current(
 account_key text primary key default 'main',
 run_id uuid not null references public.ozon_finance_crossdock_runs(run_id),
 published_at timestamptz not null default now()
);
alter table public.ozon_finance_crossdock_runs enable row level security;
alter table public.ozon_finance_crossdock_items enable row level security;
alter table public.ozon_finance_crossdock_current enable row level security;
revoke all on public.ozon_finance_crossdock_runs from anon,authenticated;
revoke all on public.ozon_finance_crossdock_items from anon,authenticated;
revoke all on public.ozon_finance_crossdock_current from anon,authenticated;
create or replace function public.ozon_finance_crossdock_totals(p_account text default 'main')
returns table(sku text,quantity bigint,as_of timestamptz)
language sql stable security invoker set search_path=public as $$
 select e.sku,sum(e.quantity)::bigint,max(c.published_at)
 from public.ozon_finance_crossdock_current c
 join public.ozon_finance_crossdock_items e on e.run_id=c.run_id
 where c.account_key=p_account
 group by e.sku
$$;
revoke all on function public.ozon_finance_crossdock_totals(text) from public,anon,authenticated;
grant execute on function public.ozon_finance_crossdock_totals(text) to service_role;
