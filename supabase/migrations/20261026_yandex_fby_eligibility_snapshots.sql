-- Yandex FBY: импорт официальной матрицы допустимости артикул × склад.
-- Данные используются как обязательная проверка до расчёта потребности.
create table if not exists public.yandex_fby_eligibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_file text not null,
  offers_count integer not null check (offers_count > 0),
  warehouse_count integer not null check (warehouse_count > 0),
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  headers jsonb not null check (jsonb_typeof(headers) = 'array'),
  unknown_offers jsonb not null default '[]'::jsonb
);
create index if not exists idx_yandex_fby_eligibility_created_at
  on public.yandex_fby_eligibility_snapshots (created_at desc);
alter table public.yandex_fby_eligibility_snapshots enable row level security;
revoke all on public.yandex_fby_eligibility_snapshots from anon, authenticated;
grant select, insert on public.yandex_fby_eligibility_snapshots to service_role;
