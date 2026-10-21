-- WB financier: persistent 31-day ledger cache. Run in Supabase SQL editor before deploying endpoints.
create table if not exists public.wb_finance_cache_jobs (
 run_day date primary key,
 date_from date not null,
 date_to date not null,
 status text not null default 'pending' check (status in ('pending','running','waiting','complete','failed')),
 next_offset integer not null default 0,
 rows_saved integer not null default 0,
 retry_at timestamptz,
 last_error text,
 started_at timestamptz default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.wb_finance_cache_lines (
 run_day date not null references public.wb_finance_cache_jobs(run_day) on delete cascade,
 line_index integer not null,
 payload jsonb not null,
 primary key (run_day,line_index)
);
create index if not exists wb_finance_cache_lines_day_idx on public.wb_finance_cache_lines(run_day);
alter table public.wb_finance_cache_jobs enable row level security;
alter table public.wb_finance_cache_lines enable row level security;
revoke all on public.wb_finance_cache_jobs from anon,authenticated;
revoke all on public.wb_finance_cache_lines from anon,authenticated;
