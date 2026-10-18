-- Ozon financier: isolated financial ledger, immutable import generations.
-- No grants for anon/authenticated. Only server-side service role may read/write.
create table if not exists public.ozon_finance_sync_days (
  account_key text not null default 'main',
  day date not null,
  active_run_id uuid not null,
  record_count integer not null check (record_count >= 0),
  synced_at timestamptz not null default now(),
  primary key (account_key, day)
);

create table if not exists public.ozon_finance_accruals (
  run_id uuid not null,
  account_key text not null default 'main',
  day date not null,
  row_index integer not null check (row_index >= 0),
  amount numeric(18, 2) not null,
  type_id text,
  accrued_category text,
  unit_number text,
  sku text,
  raw jsonb not null,
  inserted_at timestamptz not null default now(),
  primary key (run_id, row_index)
);
create index if not exists ozon_finance_accruals_day_index
on public.ozon_finance_accruals (account_key, day, run_id);
create index if not exists ozon_finance_accruals_sku_index
on public.ozon_finance_accruals (sku);

create table if not exists public.ozon_finance_sku_map (
  account_key text not null default 'main',
  sku text not null,
  offer_id text,
  master_code text,
  synced_at timestamptz not null default now(),
  primary key(account_key, sku)
);

create table if not exists public.ozon_finance_costs (
  master_code text not null,
  valid_from date not null,
  unit_cost_rub numeric(18, 4) not null check (unit_cost_rub >= 0),
  updated_at timestamptz not null default now(),
  primary key(master_code, valid_from)
);

create table if not exists public.ozon_finance_managers (
  master_code text primary key,
  manager_name text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ozon_finance_types (
  type_id text primary key,
  name text,
  description text,
  synced_at timestamptz not null default now()
);
alter table public.ozon_finance_types enable row level security;

alter table public.ozon_finance_sync_days enable row level security;
alter table public.ozon_finance_accruals enable row level security;
alter table public.ozon_finance_sku_map enable row level security;
alter table public.ozon_finance_costs enable row level security;
alter table public.ozon_finance_managers enable row level security;

revoke all on public.ozon_finance_types from anon, authenticated;
revoke all on public.ozon_finance_sync_days from anon, authenticated;
revoke all on public.ozon_finance_accruals from anon, authenticated;
revoke all on public.ozon_finance_sku_map from anon, authenticated;
revoke all on public.ozon_finance_costs from anon, authenticated;
revoke all on public.ozon_finance_managers from anon, authenticated;

-- Group on the database: never download 50k raw records into a serverless request.
create or replace function public.ozon_finance_report(
  p_from date,
  p_to date,
  p_account_key text default 'main'
)
returns table (
  sku text,
  type_id text,
  accrued_category text,
  amount numeric,
  item_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.sku, a.type_id, a.accrued_category,
         sum(a.amount) as amount, count(*) as item_count
  from public.ozon_finance_accruals a
  join public.ozon_finance_sync_days d
    on d.account_key = a.account_key
    and d.day = a.day
    and d.active_run_id = a.run_id
  where a.account_key = p_account_key
    and a.day between p_from and p_to
  group by a.sku, a.type_id, a.accrued_category
$$;
revoke all on function public.ozon_finance_report(date,date,text) from public, anon, authenticated;
grant execute on function public.ozon_finance_report(date,date,text) to service_role;

-- Imported sales history is not a financial closing record; it supplies a
-- provisional cost-of-goods estimate only when the chosen dates are covered.
create or replace function public.ozon_finance_sold_units(p_from date,p_to date)
returns table (master_code text, sold_units bigint)
language sql stable security invoker set search_path = public as $$
  select p.master_code, sum(s.sales_quantity)::bigint
  from public.ozon_sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_from and p_to and p.master_code is not null
  group by p.master_code
$$;
revoke all on function public.ozon_finance_sold_units(date,date) from public,anon,authenticated;
grant execute on function public.ozon_finance_sold_units(date,date) to service_role;
