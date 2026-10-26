create table public.yandex_finance_reports (
 id uuid primary key default gen_random_uuid(), date_from date not null, date_to date not null,
 status text not null check (status in ('loading','ready','failed')),
 phase text not null default 'services_request', report_id text, services_report_id text, orders_report_id text,
 next_request_at timestamptz, locked_until timestamptz,
 line_count integer not null default 0, error text, created_at timestamptz not null default now(), completed_at timestamptz,
 check (date_from<=date_to)
);
create table public.yandex_finance_lines (
 report_id uuid not null references public.yandex_finance_reports(id) on delete cascade,
 line_index integer not null, payload jsonb not null, primary key(report_id,line_index)
);
alter table public.yandex_finance_reports enable row level security;
alter table public.yandex_finance_lines enable row level security;
revoke all on public.yandex_finance_reports,public.yandex_finance_lines from anon, authenticated;
grant all on public.yandex_finance_reports,public.yandex_finance_lines to service_role;
create index yandex_finance_reports_period on public.yandex_finance_reports(date_from,date_to,created_at desc);

alter table public.yandex_finance_reports add column services_base64 text;
create unique index yandex_finance_single_loading_report on public.yandex_finance_reports(status) where status='loading';
