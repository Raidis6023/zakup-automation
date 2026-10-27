create table public.yandex_finance_rates (
 master_code text not null check(master_code ~ '^[A-Z0-9]{6}$'),
 valid_from date not null, cost_cents bigint check(cost_cents>=0),
 mayak_cents bigint check(mayak_cents>=0), source text not null default 'site',
 version bigint not null default 1, updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(), primary key(master_code,valid_from)
);
create table public.yandex_finance_rate_audit (
 id uuid primary key default gen_random_uuid(), master_code text not null, valid_from date not null,
 actor_id uuid, old_value jsonb, new_value jsonb not null, changed_at timestamptz not null default now()
);
create function public.audit_yandex_finance_rate() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.yandex_finance_rate_audit(master_code,valid_from,actor_id,old_value,new_value)
 values(new.master_code,new.valid_from,new.updated_by,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.audit_yandex_finance_rate() from public,anon,authenticated;
grant execute on function public.audit_yandex_finance_rate() to service_role;
create trigger yandex_finance_rate_changed after insert or update on public.yandex_finance_rates for each row execute function public.audit_yandex_finance_rate();
create table public.yandex_finance_order_quantities (
 report_id uuid not null references public.yandex_finance_reports(id) on delete cascade,
 order_id text not null, item_id text not null, article text not null, name text not null,
 order_date date not null, quantity integer not null check(quantity>=0), status text not null,
 primary key(report_id,order_id,item_id)
);
alter table public.yandex_finance_reports add column order_units_complete boolean not null default false,
 add column order_state jsonb not null default '{}'::jsonb, add column business_id bigint;
alter table public.yandex_finance_rates enable row level security;
alter table public.yandex_finance_rate_audit enable row level security;
alter table public.yandex_finance_order_quantities enable row level security;
revoke all on public.yandex_finance_rates,public.yandex_finance_rate_audit,public.yandex_finance_order_quantities from anon,authenticated;
grant all on public.yandex_finance_rates,public.yandex_finance_rate_audit,public.yandex_finance_order_quantities to service_role;

create table public.yandex_finance_article_rates (
 article text not null check(length(article)>0), valid_from date not null,
 cost_cents bigint check(cost_cents>=0), mayak_cents bigint check(mayak_cents>=0),
 source text not null default 'site', version bigint not null default 1,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 primary key(article,valid_from)
);
alter table public.yandex_finance_article_rates enable row level security;
revoke all on public.yandex_finance_article_rates from anon,authenticated;
grant all on public.yandex_finance_article_rates to service_role;
create or replace function public.audit_yandex_finance_rate() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.yandex_finance_rate_audit(master_code,valid_from,actor_id,old_value,new_value)
 values(coalesce(to_jsonb(new)->>'master_code','Артикул: '||(to_jsonb(new)->>'article')),new.valid_from,new.updated_by,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger yandex_finance_article_rate_changed after insert or update on public.yandex_finance_article_rates for each row execute function public.audit_yandex_finance_rate();

