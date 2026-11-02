create table if not exists public.ved_offer_calculation_versions(
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.ved_commercial_offers(id) on delete restrict,
 version_no integer not null check (version_no >= 1),
 calculation_date date not null,
 items_data jsonb not null,
 tariffs_data jsonb not null default '{}'::jsonb,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(offer_id,version_no)
);
create index if not exists ved_offer_calc_offer_created on public.ved_offer_calculation_versions(offer_id,created_at desc);
alter table public.ved_offer_calculation_versions enable row level security;
revoke all on public.ved_offer_calculation_versions from public,anon,authenticated;
grant select,insert on public.ved_offer_calculation_versions to service_role;
