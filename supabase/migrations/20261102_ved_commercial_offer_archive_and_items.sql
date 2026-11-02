-- Production migration applied as ved_commercial_offer_archive_and_items_20261102,
-- with raw-row followup ved_offer_raw_row_provenance_20261102.
create table if not exists public.ved_commercial_offers (
 id uuid primary key default gen_random_uuid(),
 quote_code text not null unique,
 supplier_code text not null check(supplier_code in('ROY','MU')),
 quote_date date not null,
 original_file_name text not null,
 storage_path text not null unique,
 file_size_bytes bigint not null check(file_size_bytes>0 and file_size_bytes<=50000000),
 status text not null default 'uploading' check(status in('uploading','imported','needs_review','failed')),
 item_count integer not null default 0,
 import_notes text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.ved_commercial_offer_items(
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.ved_commercial_offers(id) on delete restrict,
 source_sheet text not null,source_row integer not null,
 supplier_article text not null default '',
 description_original text not null default '',
 detected_data jsonb not null default '{}'::jsonb,
 missing_fields text[] not null default '{}',
 warnings text[] not null default '{}',
 raw_row jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 unique(offer_id,source_sheet,source_row)
);
create index if not exists ved_commercial_offers_created_at_idx on public.ved_commercial_offers(created_at desc);
create index if not exists ved_commercial_offer_items_offer_idx on public.ved_commercial_offer_items(offer_id,source_row);
alter table public.ved_commercial_offers enable row level security;
alter table public.ved_commercial_offer_items enable row level security;
revoke all on public.ved_commercial_offers,public.ved_commercial_offer_items from public,anon,authenticated;
grant select,insert,update on public.ved_commercial_offers,public.ved_commercial_offer_items to service_role;
alter table public.ved_calculation_snapshots add column if not exists offer_item_id uuid references public.ved_commercial_offer_items(id) on delete set null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ved-commercial-offers','ved-commercial-offers',false,50000000,
 array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-excel','application/vnd.ms-excel.sheet.macroEnabled.12',
 'application/octet-stream'])
on conflict(id)do nothing;
