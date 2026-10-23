-- FBW draft creation ledger. Service-role only: no public RLS policies.
create table if not exists public.wb_fbw_draft_runs (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  fingerprint text not null,
  period_end date not null,
  stock_snapshot_id uuid,
  status text not null default 'creating'
    check (status in ('creating','draft_created','ready','failed')),
  draft_id uuid,
  sku_count integer not null default 0 check (sku_count >= 0),
  units integer not null default 0 check (units >= 0),
  cartons integer not null default 0 check (cartons >= 0),
  items jsonb not null default '[]'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wb_fbw_draft_runs_created_idx
  on public.wb_fbw_draft_runs (created_at desc);
alter table public.wb_fbw_draft_runs enable row level security;
revoke all on public.wb_fbw_draft_runs from anon, authenticated;
comment on table public.wb_fbw_draft_runs is
  'WB FBW drafts; only server-side service role may read/write. No time slot or cargo API.';
