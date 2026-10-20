create or replace function public.ozon_finance_stock_summary()
returns table(product_id uuid,ozon_stock bigint,main_stock bigint,ox_stock bigint,
 ozon_at date,main_at date,ox_at date)
language sql stable security invoker set search_path=public as $$
 with
 z_day as (select max(snapshot_date) dt from public.ozon_stock_snapshots),
 m_day as (select max(snapshot_date) dt from public.own_stock_snapshots where warehouse_name not ilike '%тест%'),
 h_day as (select max(snapshot_date) dt from public.responsible_storage_stock_snapshots),
 z as (select s.product_id,sum(s.quantity)::bigint qty from public.ozon_stock_snapshots s
   join z_day d on s.snapshot_date=d.dt group by s.product_id),
 m as (select s.product_id,sum(s.quantity)::bigint qty from public.own_stock_snapshots s
   join m_day d on s.snapshot_date=d.dt where s.warehouse_name not ilike '%тест%' group by s.product_id),
 h as (select s.product_id,sum(s.quantity)::bigint qty from public.responsible_storage_stock_snapshots s
   join h_day d on s.snapshot_date=d.dt group by s.product_id)
 select coalesce(z.product_id,m.product_id,h.product_id),
 z.qty,m.qty,h.qty,(select dt from z_day),(select dt from m_day),(select dt from h_day)
 from z full join m on z.product_id=m.product_id
 full join h on coalesce(z.product_id,m.product_id)=h.product_id
$$;
revoke all on function public.ozon_finance_stock_summary() from public,anon,authenticated;
grant execute on function public.ozon_finance_stock_summary() to service_role;
