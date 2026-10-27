create table if not exists public.yandex_promotion_jobs (
 day date not null,kind text not null check(kind in ('sales','shows')),
 status text not null default 'pending' check(status in ('pending','requested','complete','failed')),
 report_id text,error text,updated_at timestamptz not null default now(),
 primary key(day,kind)
);
create table if not exists public.yandex_promotion_daily (
 day date not null,kind text not null check(kind in ('sales','shows')),offer_id text not null,
 expense numeric not null check(expense>=0),views bigint check(views>=0),clicks bigint check(clicks>=0),
 carts bigint check(carts>=0),orders bigint check(orders>=0),revenue numeric check(revenue>=0),
 primary key(offer_id,day,kind)
);
create table if not exists public.yandex_promotion_control (
 id int primary key check(id=1),locked_until timestamptz,next_request_at timestamptz,error text
);
insert into public.yandex_promotion_control(id) values(1) on conflict do nothing;
alter table public.yandex_promotion_jobs enable row level security;
alter table public.yandex_promotion_daily enable row level security;
alter table public.yandex_promotion_control enable row level security;
revoke all on public.yandex_promotion_jobs,public.yandex_promotion_daily,public.yandex_promotion_control from anon,authenticated;
grant all on public.yandex_promotion_jobs,public.yandex_promotion_daily,public.yandex_promotion_control to service_role;
