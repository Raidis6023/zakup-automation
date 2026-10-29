create or replace function public.ozon_finance_unallocated_daily_v1(
  p_from date,
  p_to date,
  p_account text default 'main'
)
returns table(
  day date,
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
  select d.day,
    coalesce(v.type_id, 'UNSPECIFIED')::text as type_id,
    v.accrued_category,
    sum(v.amount)::numeric as amount,
    sum(v.item_count)::bigint as item_count
  from public.ozon_finance_sync_days d
  cross join lateral public.ozon_finance_report_v3(d.day, d.day, p_account) v
  where d.account_key = p_account
    and d.day between p_from and p_to
    and v.sku is null
  group by d.day, v.type_id, v.accrued_category
  order by d.day, v.type_id, v.accrued_category
$$;

revoke all on function public.ozon_finance_unallocated_daily_v1(date,date,text) from public, anon, authenticated;
grant execute on function public.ozon_finance_unallocated_daily_v1(date,date,text) to service_role;
