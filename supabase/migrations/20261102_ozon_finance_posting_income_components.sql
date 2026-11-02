-- Informational components, already accounted for in Ozon POSTING, not new income.
create or replace function public.ozon_finance_posting_income_components_v1(p_from date,p_to date,p_account text default 'main')
returns table(sku text,sale_amount numeric,bonus numeric,coinvestment numeric)
language sql stable set search_path=public as $$
select p->>'sku',
round(sum(coalesce((p#>>'{commission,sale_amount,amount}')::numeric,0)),2),
round(sum(coalesce((p#>>'{commission,bonus,amount}')::numeric,0)),2),
round(sum(coalesce((p#>>'{commission,coinvestment,amount}')::numeric,0)),2)
from public.ozon_finance_accruals a cross join lateral jsonb_array_elements(coalesce(a.raw#>'{posting,products}','[]'::jsonb)) p
where a.account_key=p_account and a.day between p_from and p_to and a.accrued_category='POSTING' and jsonb_typeof(p)='object'
group by p->>'sku'
$$;
revoke all on function public.ozon_finance_posting_income_components_v1(date,date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_posting_income_components_v1(date,date,text) to service_role;
