-- Explicit ITEM accrual fee rows are authoritative at the SKU level.
-- Older reports grouped multi-SKU ITEM accruals as unallocated. Only split
-- those whose nested sum reconciles EXACTLY to the parent amount.
create or replace function public.ozon_finance_report_v3(
  p_from date,p_to date,p_account_key text default 'main'
)
returns table(sku text,type_id text,accrued_category text,amount numeric,item_count bigint)
language sql stable security invoker set search_path=public as $$
with source as (
 select a.run_id,a.row_index,a.raw,a.sku,
   a.type_id,a.accrued_category,a.amount
 from public.ozon_finance_accruals a
 join public.ozon_finance_sync_days d
   on d.day=a.day and d.account_key=a.account_key
  and d.active_run_id=a.run_id
 where a.account_key=p_account_key and a.day between p_from and p_to
),
rawfees as (
 select s.run_id,s.row_index,s.amount as parent_amount,
   item->>'sku' as sku,
   fee->>'type_id' as fee_type,
   fee#>>'{accrued,amount}' as fee_money
 from source s
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(s.raw#>'{item_fees,fees}')='array'
   then s.raw#>'{item_fees,fees}' else '[]'::jsonb end
 ) item
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(item->'fees')='array'
   then item->'fees' else '[]'::jsonb end
 ) fee
 where s.accrued_category='ITEM' and s.sku is null
),
itemchecks as (
 select run_id,row_index,
 count(*) as fee_count,
 count(*) filter(where sku !~ '^[0-9]{1,30}$'
    or fee_type !~ '^[0-9]+$'
    or fee_money !~ '^-?[0-9]+(\.[0-9]{1,2})?$') as invalid_count,
 sum(case when fee_money ~ '^-?[0-9]+(\.[0-9]{1,2})?$'
   then fee_money::numeric else 0 end)::numeric as split_sum,
 max(parent_amount) as parent_amount
 from rawfees
 group by run_id,row_index
),
eligible as (
 select run_id,row_index from itemchecks
 where invalid_count=0 and fee_count>0 and split_sum=parent_amount
),
parts as (
 select r.sku,r.fee_type as type_id,
   'ITEM'::text as accrued_category,r.fee_money::numeric as amount
 from rawfees r
 join eligible e using(run_id,row_index)
),
unchanged as (
 select s.sku,coalesce(s.type_id,
   s.raw#>>'{non_item_fee,type_id}',
   s.raw#>>'{container_fees,fees,0,type_id}') as type_id,
   s.accrued_category,s.amount
 from source s
 left join eligible e using(run_id,row_index)
 where e.run_id is null
),
allentries as (
 select * from parts union all select * from unchanged
)
select x.sku,x.type_id,x.accrued_category,
  sum(x.amount)::numeric as amount,count(*)::bigint as item_count
from allentries x
group by x.sku,x.type_id,x.accrued_category
$$;
revoke all on function public.ozon_finance_report_v3(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_report_v3(date,date,text) to service_role;

create or replace function public.ozon_finance_unallocated_v3(
 p_from date,p_to date,p_account text default 'main'
)
returns table(type_id text,accrued_category text,amount numeric,item_count bigint)
language sql stable security invoker set search_path=public as $$
 select coalesce(v.type_id,'UNSPECIFIED')::text,
   v.accrued_category,sum(v.amount)::numeric,sum(v.item_count)::bigint
 from public.ozon_finance_report_v3(p_from,p_to,p_account) v
 where v.sku is null
 group by v.type_id,v.accrued_category
$$;
revoke all on function public.ozon_finance_unallocated_v3(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_unallocated_v3(date,date,text) to service_role;