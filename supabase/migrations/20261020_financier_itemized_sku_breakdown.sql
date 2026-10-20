-- Exact-itemized ledger view for drill-down. Components are information
-- within each Seller accrual, NEVER new deductions. The remainder guarantees
-- sum(components) == original posted accrual for every raw record.
create or replace function public.ozon_finance_itemized_per_sku(
 p_from date,p_to date,p_account text default 'main'
)
returns table(sku text,type_id text,name text,amount numeric,item_count bigint)
language sql stable security invoker set search_path=public as $$
with src as (
 select a.run_id,a.row_index,a.sku,a.raw,a.amount,a.accrued_category
 from public.ozon_finance_accruals a
 join public.ozon_finance_sync_days d on d.account_key=a.account_key
  and d.day=a.day and d.active_run_id=a.run_id
 where a.account_key=p_account and a.day between p_from and p_to and a.sku is not null
),
line as (
 select s.run_id,s.row_index,s.sku,'SALES'::text as type_id,
  'Выручка от продажи (в составе начисления Ozon)'::text as name,
  coalesce(nullif(p#>>'{commission,seller_price,amount}','')::numeric,0)
    * greatest(coalesce(nullif(p->>'quantity','')::numeric,1),0) as amount
 from src s cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.raw#>'{posting,products}')='array'
   then s.raw#>'{posting,products}' else '[]'::jsonb end) p
 where p#>>'{commission,seller_price,amount}' is not null
 union all
 select s.run_id,s.row_index,s.sku,'COMMISSION','Комиссия Ozon',
  (p#>>'{commission,commission,amount}')::numeric
 from src s cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.raw#>'{posting,products}')='array'
   then s.raw#>'{posting,products}' else '[]'::jsonb end) p
 where p#>>'{commission,commission,amount}' is not null
 union all
 select s.run_id,s.row_index,s.sku,coalesce(svc->>'type_id','SERVICE'),
  'Услуга Ozon №'||coalesce(svc->>'type_id','?'),
  (svc#>>'{accrued,amount}')::numeric
 from src s cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.raw#>'{posting,products}')='array'
   then s.raw#>'{posting,products}' else '[]'::jsonb end) p
 cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p#>'{delivery,services}')='array'
   then p#>'{delivery,services}' else '[]'::jsonb end) svc
 where svc#>>'{accrued,amount}' is not null
 union all
 select s.run_id,s.row_index,s.sku,coalesce(fee->>'type_id','ITEM'),
  'Услуга товара №'||coalesce(fee->>'type_id','?'),
  (fee#>>'{accrued,amount}')::numeric
 from src s cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.raw#>'{item_fees,fees}')='array'
   then s.raw#>'{item_fees,fees}' else '[]'::jsonb end) product
 cross join lateral jsonb_array_elements(
  case when jsonb_typeof(product->'fees')='array'
   then product->'fees' else '[]'::jsonb end) fee
 where fee#>>'{accrued,amount}' is not null
), sums as (
 select run_id,row_index,sum(amount)::numeric amount from line
 group by run_id,row_index
), all_lines as (
 select sku,type_id,name,amount from line
 union all
 select s.sku,'REMAINDER'::text,'Прочие начисления по отправлению'::text,
 s.amount-coalesce(x.amount,0)
 from src s left join sums x on x.run_id=s.run_id and x.row_index=s.row_index
 where s.amount<>coalesce(x.amount,0)
)
select l.sku,l.type_id,l.name,sum(l.amount)::numeric,count(*)::bigint
from all_lines l group by l.sku,l.type_id,l.name
$$;
revoke all on function public.ozon_finance_itemized_per_sku(date,date,text)
 from public,anon,authenticated;
grant execute on function public.ozon_finance_itemized_per_sku(date,date,text) to service_role;