
-- Mayak per-order-item cost, independently versioned from merchandise COGS.
create table if not exists public.ozon_finance_mayak (
  master_code text not null,
  valid_from date not null,
  unit_cost_rub numeric(18,4) not null check(unit_cost_rub >= 0),
  updated_at timestamptz not null default now(),
  primary key(master_code,valid_from)
);
alter table public.ozon_finance_mayak enable row level security;
revoke all on public.ozon_finance_mayak from anon,authenticated;

-- This site's ozon_sales_daily.sales_quantity is computed by summing
-- products.quantity from FBO posting orders excluding cancelled postings.
-- It is ordered FBO UNITS, not distinct customer orders or fulfilled buyouts.
create or replace function public.ozon_finance_cost_breakdown(
  p_from date, p_to date
)
returns table(
  offer_id text, master_code text, ordered_units bigint,
  covered_cogs_units bigint, covered_mayak_units bigint,
  cogs_total numeric, mayak_total numeric
)
language sql stable security invoker set search_path=public as $$
  with dated as (
    select p.offer_id, p.master_code, s.sale_date, sum(s.sales_quantity)::bigint as qty
    from public.ozon_sales_daily s
    join public.products p on p.id=s.product_id
    where s.sale_date between p_from and p_to
      and p.offer_id is not null and p.master_code is not null
    group by p.offer_id,p.master_code,s.sale_date
  ),
  resolved as (
    select d.*,
     (select c.unit_cost_rub from public.ozon_finance_costs c
       where c.master_code=d.master_code and c.valid_from<=d.sale_date
       order by c.valid_from desc limit 1) as cost,
     (select m.unit_cost_rub from public.ozon_finance_mayak m
       where m.master_code=d.master_code and m.valid_from<=d.sale_date
       order by m.valid_from desc limit 1) as mayak
    from dated d
  )
  select r.offer_id,r.master_code,sum(r.qty)::bigint,
    sum(case when r.cost is null then 0 else r.qty end)::bigint,
    sum(case when r.mayak is null then 0 else r.qty end)::bigint,
    coalesce(sum(r.qty*r.cost),0)::numeric,
    coalesce(sum(r.qty*r.mayak),0)::numeric
  from resolved r
  group by r.offer_id,r.master_code
$$;
revoke all on function public.ozon_finance_cost_breakdown(date,date) from public,anon,authenticated;
grant execute on function public.ozon_finance_cost_breakdown(date,date) to service_role;
