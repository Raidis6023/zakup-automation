-- Ozon FBO: очередь автоматического создания заявок по кластерам.
-- Одна supply-run соответствует одному расчёту потребности.
-- Повторный запуск того же расчёта не создаёт дубль.

create table if not exists public.ozon_fbo_supply_runs (
  id uuid primary key default gen_random_uuid(),
  calculation_run_id uuid not null unique
    references public.ozon_fbo_replenishment_runs(id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  updated_at timestamptz not null default now(),

  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),

  seller_warehouse_id bigint not null,
  drop_off_warehouse_id bigint not null,
  drop_off_warehouse_type text not null,
  drop_off_name text null,
  drop_off_address text null,

  formation_date date not null,
  target_date date not null,
  window_date_from date not null,
  window_date_to date not null,

  next_draft_allowed_at timestamptz null,
  next_supply_allowed_at timestamptz null,

  total_clusters integer not null default 0 check (total_clusters >= 0),
  success_clusters integer not null default 0 check (success_clusters >= 0),
  no_slot_clusters integer not null default 0 check (no_slot_clusters >= 0),
  failed_clusters integer not null default 0 check (failed_clusters >= 0),
  total_units bigint not null default 0 check (total_units >= 0),

  last_error text null
);

create table if not exists public.ozon_fbo_supply_requests (
  id uuid primary key default gen_random_uuid(),
  supply_run_id uuid not null
    references public.ozon_fbo_supply_runs(id) on delete cascade,
  calculation_run_id uuid not null
    references public.ozon_fbo_replenishment_runs(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  macrolocal_cluster_id bigint not null,
  cluster_type text not null,
  cluster_name text null,
  source_cluster_ids jsonb not null default '[]'::jsonb,
  source_cluster_names jsonb not null default '[]'::jsonb,

  items jsonb not null,
  sku_count integer not null default 0 check (sku_count >= 0 and sku_count <= 5000),
  total_units bigint not null default 0 check (total_units >= 0),

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'draft_created',
        'draft_ready',
        'slot_selected',
        'creating',
        'success',
        'no_slot',
        'failed'
      )
    ),

  draft_id bigint null,

  storage_warehouse_id bigint null,
  storage_warehouse_name text null,
  storage_warehouse_address text null,

  timeslot_from timestamptz null,
  timeslot_to timestamptz null,

  ozon_order_id bigint null,

  next_attempt_at timestamptz null default now(),
  attempts integer not null default 0 check (attempts >= 0),

  is_processing boolean not null default false,
  processing_started_at timestamptz null,

  error_message text null,

  raw_draft jsonb null,
  raw_info jsonb null,
  raw_timeslots jsonb null,
  raw_create jsonb null,
  raw_status jsonb null,

  unique (supply_run_id, macrolocal_cluster_id)
);

create index if not exists ozon_fbo_supply_requests_queue_idx
  on public.ozon_fbo_supply_requests (
    supply_run_id,
    status,
    next_attempt_at
  );

alter table public.ozon_fbo_supply_runs enable row level security;
alter table public.ozon_fbo_supply_requests enable row level security;


create or replace function public.create_ozon_fbo_supply_run(
  p_calculation_run_id uuid,
  p_seller_warehouse_id bigint,
  p_drop_off_warehouse_id bigint,
  p_drop_off_warehouse_type text,
  p_drop_off_name text,
  p_drop_off_address text,
  p_formation_date date,
  p_target_date date,
  p_window_date_from date,
  p_window_date_to date,
  p_clusters jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_run_id uuid;
  v_cluster jsonb;
  v_items jsonb;
  v_total_units bigint;
  v_total_all bigint := 0;
begin
  select id
    into v_existing_id
  from public.ozon_fbo_supply_runs
  where calculation_run_id = p_calculation_run_id
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_clusters is null
     or jsonb_typeof(p_clusters) <> 'array'
     or jsonb_array_length(p_clusters) = 0 then
    raise exception 'Supply plan contains no clusters';
  end if;

  insert into public.ozon_fbo_supply_runs (
    calculation_run_id,
    seller_warehouse_id,
    drop_off_warehouse_id,
    drop_off_warehouse_type,
    drop_off_name,
    drop_off_address,
    formation_date,
    target_date,
    window_date_from,
    window_date_to,
    total_clusters
  )
  values (
    p_calculation_run_id,
    p_seller_warehouse_id,
    p_drop_off_warehouse_id,
    p_drop_off_warehouse_type,
    p_drop_off_name,
    p_drop_off_address,
    p_formation_date,
    p_target_date,
    p_window_date_from,
    p_window_date_to,
    jsonb_array_length(p_clusters)
  )
  returning id into v_run_id;

  for v_cluster in
    select value
    from jsonb_array_elements(p_clusters)
  loop
    v_items := coalesce(v_cluster -> 'items', '[]'::jsonb);

    if jsonb_typeof(v_items) <> 'array'
       or jsonb_array_length(v_items) = 0 then
      raise exception
        'Cluster % contains no items',
        v_cluster ->> 'macrolocal_cluster_id';
    end if;

    if jsonb_array_length(v_items) > 5000 then
      raise exception
        'Cluster % contains more than 5000 SKU',
        v_cluster ->> 'macrolocal_cluster_id';
    end if;

    select coalesce(sum((item ->> 'quantity')::bigint), 0)
      into v_total_units
    from jsonb_array_elements(v_items) as item;

    v_total_all := v_total_all + v_total_units;

    insert into public.ozon_fbo_supply_requests (
      supply_run_id,
      calculation_run_id,
      macrolocal_cluster_id,
      cluster_type,
      cluster_name,
      source_cluster_ids,
      source_cluster_names,
      items,
      sku_count,
      total_units
    )
    values (
      v_run_id,
      p_calculation_run_id,
      (v_cluster ->> 'macrolocal_cluster_id')::bigint,
      coalesce(v_cluster ->> 'cluster_type', ''),
      nullif(v_cluster ->> 'cluster_name', ''),
      coalesce(v_cluster -> 'source_cluster_ids', '[]'::jsonb),
      coalesce(v_cluster -> 'source_cluster_names', '[]'::jsonb),
      v_items,
      jsonb_array_length(v_items),
      v_total_units
    );
  end loop;

  update public.ozon_fbo_supply_runs
  set
    total_units = v_total_all,
    updated_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$$;


create or replace function public.claim_next_ozon_fbo_supply_request(
  p_run_id uuid
)
returns setof public.ozon_fbo_supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.ozon_fbo_supply_requests
  set
    is_processing = false,
    processing_started_at = null,
    updated_at = now()
  where supply_run_id = p_run_id
    and is_processing = true
    and processing_started_at < now() - interval '3 minutes';

  select id
    into v_id
  from public.ozon_fbo_supply_requests
  where supply_run_id = p_run_id
    and status in (
      'queued',
      'draft_created',
      'draft_ready',
      'slot_selected',
      'creating'
    )
    and is_processing = false
    and (
      next_attempt_at is null
      or next_attempt_at <= now()
    )
  order by
    case status
      when 'creating' then 1
      when 'slot_selected' then 2
      when 'draft_ready' then 3
      when 'draft_created' then 4
      when 'queued' then 5
      else 99
    end,
    created_at asc,
    macrolocal_cluster_id asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.ozon_fbo_supply_requests
  set
    is_processing = true,
    processing_started_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  where id = v_id;

  return query
  select *
  from public.ozon_fbo_supply_requests
  where id = v_id;
end;
$$;


revoke all on function public.create_ozon_fbo_supply_run(
  uuid, bigint, bigint, text, text, text, date, date, date, date, jsonb
) from public, anon, authenticated;

revoke all on function public.claim_next_ozon_fbo_supply_request(uuid)
  from public, anon, authenticated;

grant execute on function public.create_ozon_fbo_supply_run(
  uuid, bigint, bigint, text, text, text, date, date, date, date, jsonb
) to service_role;

grant execute on function public.claim_next_ozon_fbo_supply_request(uuid)
  to service_role;
