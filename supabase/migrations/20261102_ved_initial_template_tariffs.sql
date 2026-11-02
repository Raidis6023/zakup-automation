-- Seed initial estimate values found in user-uploaded "НовыйШаблонБезМакросов.xlsx".
-- Approved as starting assumptions, not universal per-product customs facts.
insert into public.ved_tariff_history(tariff_key,effective_from,amount,reason,actor_user_id)
select x.key,date '2026-11-02',x.amount,
 'Начальное значение из загруженного шаблона «НовыйШаблонБезМакросов.xlsx»; проверять при изменении условий',null::uuid
from (values
 ('freightBeforeBorderRub'::text,500000::numeric),
 ('freightAfterBorderRub',500000),
 ('bankCommissionRub',10000),
 ('brokerServicesRub',15000),
 ('dangerSurchargeBeforeRub',60000),
 ('dangerSurchargeAfterRub',60000),
 ('vatPercent',22)
) x(key,amount)
where not exists(select 1 from public.ved_tariff_history h where h.tariff_key=x.key);
