-- Per-category financial accruals, historical orders, and income by listing.
-- Protect all RPCs from public roles. No duplicate booking of ad spend.
create or replace function public.ozon_finance_report_v2(
  p_from date,p_to date,p_account_key text default 'main'
)
returns table(sku text,type_id text,accrued_category text,amount numeric,item_count bigint)
language sql stable security invoker set search_path=public as $$
  select a.sku,
    coalesce(a.type_id, a.raw#>>'{non_item_fee,type_id}',
      a.raw#>>'{container_fees,fees,0,type_id}') as type_id,
    a.accrued_category, sum(a.amount)::numeric,count(*)::bigint
  from public.ozon_finance_accruals a
  join public.ozon_finance_sync_days d on d.day=a.day
    and d.account_key=a.account_key and d.active_run_id=a.run_id
  where a.account_key=p_account_key and a.day between p_from and p_to
  group by a.sku,
    coalesce(a.type_id,a.raw#>>'{non_item_fee,type_id}',
      a.raw#>>'{container_fees,fees,0,type_id}'), a.accrued_category
$$;
revoke all on function public.ozon_finance_report_v2(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_report_v2(date,date,text) to service_role;

-- Realized-order proxy is defined by the business as ordered units minus
-- cancelled units. ozon_sales_daily.sales_quantity ALREADY excludes canceled
-- FBO postings, therefore do NOT subtract cancelled_quantity twice.
create or replace function public.ozon_finance_order_totals(p_from date,p_to date)
returns table(offer_id text,master_code text,orders bigint,cancelled bigint,net_orders bigint,
  covered_cogs_units bigint,calculated_cogs numeric,mayak_total numeric,covered_mayak_units bigint)
language sql stable security invoker set search_path=public as $$
with daily as (
  select p.offer_id,p.master_code,s.sale_date,
    sum(s.sales_quantity)::bigint as net_qty,
    sum(s.cancelled_quantity)::bigint as cancelled_qty
  from public.ozon_sales_daily s
  join public.products p on p.id=s.product_id
  where s.sale_date between p_from and p_to and p.offer_id is not null
  group by p.offer_id,p.master_code,s.sale_date
),
rated as (
 select d.*,
  (select unit_cost_rub from public.ozon_finance_costs c
   where c.master_code=d.master_code and c.valid_from<=d.sale_date
   order by valid_from desc limit 1) as buy_price,
  (select unit_cost_rub from public.ozon_finance_mayak m
   where m.master_code=d.master_code and m.valid_from<=d.sale_date
   order by valid_from desc limit 1) as mayak_price
 from daily d)
select offer_id, master_code,sum(net_qty+cancelled_qty)::bigint,
  sum(cancelled_qty)::bigint,sum(net_qty)::bigint,
  sum(case when buy_price is not null then net_qty else 0 end)::bigint,
  coalesce(sum(net_qty*buy_price),0)::numeric,
  coalesce(sum(net_qty*mayak_price),0)::numeric,
  sum(case when mayak_price is not null then net_qty else 0 end)::bigint
from rated group by offer_id,master_code
$$;
revoke all on function public.ozon_finance_order_totals(date,date) from public,anon,authenticated;
grant execute on function public.ozon_finance_order_totals(date,date) to service_role;

-- Transactional sales revenue, per listing, from posting product commissions.
-- Revenue is not the net payment (which includes commissions and logistics).
create or replace function public.ozon_finance_sales_revenue(p_from date,p_to date,p_account text default 'main')
returns table(sku text,revenue numeric) language sql stable security invoker set search_path=public as $$
 select (product ->> 'sku')::text as sku,
  sum(coalesce(nullif(product#>>'{commission,seller_price,amount}','')::numeric,0)
    * greatest(coalesce(nullif(product->>'quantity','')::numeric,1),0))::numeric as revenue
 from public.ozon_finance_accruals a
 join public.ozon_finance_sync_days d on d.account_key=a.account_key
  and d.day=a.day and d.active_run_id=a.run_id
 cross join lateral jsonb_array_elements(
  case when jsonb_typeof(a.raw#>'{posting,products}')='array'
  then a.raw#>'{posting,products}' else '[]'::jsonb end) as product
 where a.day between p_from and p_to and a.account_key=p_account
  and product#>>'{commission,seller_price,amount}' is not null
 group by (product->>'sku')::text
$$;
revoke all on function public.ozon_finance_sales_revenue(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_sales_revenue(date,date,text) to service_role;
