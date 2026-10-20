-- Service-level detail for unlinked financial charges. Preserve exact
-- reconciliation: a parent raw accrual is never counted twice.
create or replace function public.ozon_finance_unallocated_breakdown(
 p_from date,p_to date,p_account text default 'main'
)
returns table(type_id text,accrued_category text,amount numeric,item_count bigint)
language sql stable security invoker set search_path=public as $$
with src as (
 select a.run_id,a.row_index,a.raw,a.amount,a.accrued_category,
    coalesce(a.type_id,a.raw#>>'{non_item_fee,type_id}') as original_type
 from public.ozon_finance_accruals a
 join public.ozon_finance_sync_days d on d.day=a.day and d.account_key=a.account_key
    and d.active_run_id=a.run_id
 where a.account_key=p_account and a.day between p_from and p_to and a.sku is null
), fee_lines as (
 select s.run_id,s.row_index,fee->>'type_id' as fee_type,
  coalesce(nullif(fee#>>'{accrued,amount}','')::numeric,0) amt
 from src s
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(s.raw#>'{item_fees,fees}')='array'
     then s.raw#>'{item_fees,fees}' else '[]'::jsonb end
 ) grp
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(grp->'fees')='array'
     then grp->'fees' else '[]'::jsonb end
 ) fee
 where s.accrued_category='ITEM'
), split_totals as (
 select run_id,row_index,sum(amt) total from fee_lines group by run_id,row_index
), all_charges as (
 select f.fee_type as tid,'ITEM'::text as category,f.amt as amount
 from fee_lines f
 union all
 select case
   when s.accrued_category='ITEM' and coalesce(st.total,0)<>0 then 'ITEM_REMAINDER'
   when s.accrued_category='ITEM' then 'ITEM_UNCLASSIFIED'
   else s.original_type end,
   s.accrued_category,
   s.amount-coalesce(st.total,0)
 from src s left join split_totals st on s.run_id=st.run_id and s.row_index=st.row_index
 where s.accrued_category<>'ITEM' or s.amount<>coalesce(st.total,0)
)
select coalesce(tid,'UNSPECIFIED')::text,category,sum(amount)::numeric,count(*)::bigint
from all_charges group by tid,category
$$;
revoke all on function public.ozon_finance_unallocated_breakdown(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_unallocated_breakdown(date,date,text) to service_role;
