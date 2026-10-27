-- Payment, cashback and subsidy in the v1 order response are totals for all units.
alter table public.yandex_finance_order_quantities
 add column in_transit_quantity integer check(in_transit_quantity>=0 and in_transit_quantity<=quantity),
 add column realization_total_cents bigint check(realization_total_cents>=0);
