-- Resumable one-page-at-a-time Ozon finance sync.
create table if not exists public.ozon_finance_page_jobs (
  account_key text not null default 'main',
  day date not null,
  run_id uuid not null default gen_random_uuid(),
  status text not null default 'running' check(status in ('running','complete','failed')),
  last_id text not null default '',
  pages_completed integer not null default 0,
  rows_saved integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(account_key,day)
);
alter table public.ozon_finance_page_jobs enable row level security;
revoke all on public.ozon_finance_page_jobs from anon,authenticated;
