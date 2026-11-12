-- Per-unit FBS warehouse packing fee: 20 RUB only for a financially
-- confirmed dispatched posting. A cancelled order without a shipment is NOT
-- considered packaged. Never invent an allocation for multi-SKU postings.
create or replace function public.ozon_finance_fbs_packing_v1(
 p_from date,p_to date,p_account text default 'main'
) returns table(sku text,units bigint,amount numeric)
language sql stable security invoker set search_path=public as $$
 with confirmed as (
  select a.sku,a.unit_number,
    max(greatest(0,coalesce(nullif(a.raw #>> '{posting,products,0,quantity}','')::integer,0))) qty
  from public.ozon_finance_accruals a
  join public.ozon_finance_sync_days s
   on s.account_key=a.account_key and s.day=a.day and s.active_run_id=a.run_id
  where a.account_key=p_account and a.day between p_from and p_to
    and a.accrued_category='POSTING' and a.sku is not null and a.unit_number is not null
    and lower(a.raw #>> '{posting,delivery_schema}')='fbs'
    and jsonb_typeof(a.raw #> '{posting,products,0,commission}')='object'
    and a.raw #>> '{posting,products,0,sku}'=a.sku
  group by a.sku,a.unit_number
 )
 select confirmed.sku,sum(confirmed.qty)::bigint,(sum(confirmed.qty)*20)::numeric
 from confirmed where confirmed.qty>0 group by confirmed.sku;
$$;
revoke all on function public.ozon_finance_fbs_packing_v1(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_fbs_packing_v1(date,date,text) to service_role;
