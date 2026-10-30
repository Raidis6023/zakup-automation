-- Cached WB dimensions used by the financier. The browser never reads these
-- tables directly: authenticated server routes use service_role after an
-- application-level admin check.
create table if not exists public.wb_finance_ad_daily (
  snapshot_day date not null,
  campaign_id bigint not null,
  nm_id bigint not null,
  spend numeric(18,2) not null default 0,
  views bigint not null default 0,
  clicks bigint not null default 0,
  orders bigint not null default 0,
  sum_price numeric(18,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  primary key (snapshot_day,campaign_id,nm_id)
);

create table if not exists public.wb_finance_ad_snapshots (
  snapshot_day date primary key,
  row_count integer not null default 0,
  captured_at timestamptz not null default now()
);

create table if not exists public.wb_finance_storage_daily (
  snapshot_day date not null,
  row_key text not null,
  nm_id bigint,
  article text,
  warehouse text,
  amount numeric(18,2) not null default 0,
  payload jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (snapshot_day,row_key)
);

create table if not exists public.wb_finance_storage_snapshots (
  snapshot_day date primary key,
  source_task_id uuid,
  row_count integer not null default 0,
  captured_at timestamptz not null default now()
);

create table if not exists public.wb_finance_storage_tasks (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  remote_task_id text,
  status text not null default 'pending'
    check (status in ('pending','generating','complete','failed')),
  retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (date_from,date_to)
);

create index if not exists wb_finance_ad_daily_nm_day_idx
  on public.wb_finance_ad_daily (nm_id,snapshot_day);
create index if not exists wb_finance_storage_daily_nm_day_idx
  on public.wb_finance_storage_daily (nm_id,snapshot_day);
create index if not exists wb_finance_storage_tasks_status_idx
  on public.wb_finance_storage_tasks (status,updated_at);

alter table public.wb_finance_ad_daily enable row level security;
alter table public.wb_finance_ad_snapshots enable row level security;
alter table public.wb_finance_storage_daily enable row level security;
alter table public.wb_finance_storage_snapshots enable row level security;
alter table public.wb_finance_storage_tasks enable row level security;

revoke all on public.wb_finance_ad_daily,
  public.wb_finance_ad_snapshots,
  public.wb_finance_storage_daily,
  public.wb_finance_storage_snapshots,
  public.wb_finance_storage_tasks from anon,authenticated;

grant select,insert,update,delete on public.wb_finance_ad_daily,
  public.wb_finance_ad_snapshots,
  public.wb_finance_storage_daily,
  public.wb_finance_storage_snapshots,
  public.wb_finance_storage_tasks to service_role;
