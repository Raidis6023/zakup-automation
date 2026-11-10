-- Reference-only Ozon sale/bonus/coinvestment columns must come from the
-- active daily run. Superseded runs remain in history but must not be summed.
-- These amounts are part of the original Seller POSTING, not added to P&L.
create or replace function public.ozon_finance_posting_income_components_v1(
 p_from date,p_to date,p_account text default 'main'
)
returns table(sku text,sale_amount numeric,bonus numeric,coinvestment numeric)
language sql stable set search_path=public as $$
select p->>'sku',
 round(sum(coalesce((p#>>'{commission,sale_amount,amount}')::numeric,0)),2),
 round(sum(coalesce((p#>>'{commission,bonus,amount}')::numeric,0)),2),
 round(sum(coalesce((p#>>'{commission,coinvestment,amount}')::numeric,0)),2)
from public.ozon_finance_accruals a
join public.ozon_finance_sync_days d on d.account_key=a.account_key
 and d.day=a.day and d.active_run_id=a.run_id
cross join lateral jsonb_array_elements(
 case when jsonb_typeof(a.raw#>'{posting,products}')='array'
 then a.raw#>'{posting,products}' else '[]'::jsonb end
) p
where a.account_key=p_account and a.day between p_from and p_to
 and a.accrued_category='POSTING' and jsonb_typeof(p)='object'
group by p->>'sku'
$$;
revoke all on function public.ozon_finance_posting_income_components_v1(date,date,text)
 from public,anon,authenticated;
grant execute on function public.ozon_finance_posting_income_components_v1(date,date,text)
 to service_role;
