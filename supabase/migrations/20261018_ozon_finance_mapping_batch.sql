
-- Find unmapped finance SKUs without streaming all financial entries to Next.js.
create or replace function public.ozon_finance_unmapped_skus(
  p_day date, p_limit integer default 200, p_account text default 'main'
)
returns table(sku text)
language sql stable security invoker set search_path = public as $$
  select distinct a.sku
  from public.ozon_finance_accruals a
  join public.ozon_finance_sync_days d on
    d.account_key = a.account_key and d.day = a.day and
    d.active_run_id = a.run_id
  left join public.ozon_finance_sku_map m
    on m.account_key = a.account_key and m.sku = a.sku
  where a.account_key = p_account and a.day = p_day
    and a.sku is not null and m.sku is null
  order by a.sku
  limit greatest(1,least(p_limit,500))
$$;
revoke all on function public.ozon_finance_unmapped_skus(date,integer,text)
 from public,anon,authenticated;
grant execute on function public.ozon_finance_unmapped_skus(date,integer,text)
 to service_role;
