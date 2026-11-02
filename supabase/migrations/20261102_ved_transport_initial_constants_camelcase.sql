-- Applied in Supabase as ved_transport_initial_constants_camelcase_20261102
-- Fix camelCase tariff names; seed agreed immutable historical starting values.
alter table public.ved_tariff_history alter column actor_user_id drop not null;
alter table public.ved_tariff_history drop constraint if exists ved_tariff_history_tariff_key_check;
alter table public.ved_tariff_history add constraint ved_tariff_history_tariff_key_check
 check (tariff_key ~ '^[a-z][A-Za-z0-9_]{1,63}$');
insert into public.ved_tariff_history(tariff_key,effective_from,amount,reason,actor_user_id)
select x.tariff_key,date '2026-11-02',x.amount,
 'Начальное системное значение по согласованию ВЭД от 02.11.2026',null::uuid
from (values
 ('usableVolumeM3'::text,68::numeric),
 ('maxPayloadKg',22000),
 ('truckVolume90M3',90),
 ('truckVolume100M3',100),
 ('truckPayloadKg',20000)
) as x(tariff_key,amount)
where not exists(select 1 from public.ved_tariff_history h where h.tariff_key=x.tariff_key);
