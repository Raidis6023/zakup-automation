-- Once-a-day 05:00 Asia/Krasnoyarsk sliding finance data cache.
-- All work is planned atomically. Reports continue reading the previous
-- published run while a new generation is paginated and checkpointed.
create table if not exists public.ozon_finance_schedule_runs (
 local_date date primary key,
 account_key text not null default 'main',
 period_from date not null,
 period_to date not null,
 scheduled_missing integer not null default 0,
 scheduled_refresh integer not null default 0,
 skipped_in_progress integer not null default 0,
 is_full_reconciliation boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.ozon_finance_schedule_runs enable row level security;
revoke all on public.ozon_finance_schedule_runs from public,anon,authenticated;

create or replace function public.ozon_finance_schedule_window(
 p_local_date date,
 p_window_days integer default 31,
 p_recent_refresh_days integer default 7
) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
 first_day date;
 last_day date;
 day_cursor date;
 old_job public.ozon_finance_page_jobs%rowtype;
 cache_exists boolean;
 new_run boolean;
 full_reconciliation boolean;
 missing integer := 0;
 refreshed integer := 0;
 busy integer := 0;
 ret jsonb;
begin
 if current_user not in ('service_role','postgres') then
   raise exception 'Not authorized';
 end if;
 if p_window_days<>31 or p_recent_refresh_days<>7 then
   raise exception 'Unsupported finance rolling window configuration';
 end if;
 if p_local_date is null or p_local_date < '2026-01-01'
    or p_local_date > (now() at time zone 'Asia/Krasnoyarsk')::date then
   raise exception 'Invalid local schedule date';
 end if;
 perform pg_advisory_xact_lock(hashtext('ozon_finance_window_main'));
 first_day:=p_local_date-p_window_days;
 last_day:=p_local_date-1;
 full_reconciliation:=extract(isodow from p_local_date)=7;
 insert into public.ozon_finance_schedule_runs
  (local_date,account_key,period_from,period_to,is_full_reconciliation)
 values(p_local_date,'main',first_day,last_day,full_reconciliation)
 on conflict(local_date) do nothing;
 get diagnostics new_run = row_count;
 if not new_run then
   select to_jsonb(r) into ret
    from public.ozon_finance_schedule_runs r where r.local_date=p_local_date;
   return jsonb_build_object('ok',true,'already_planned',true,'plan',ret);
 end if;
 for day_cursor in select generate_series(first_day,last_day,'1 day'::interval)::date loop
   select exists(select 1 from public.ozon_finance_sync_days s
     where s.account_key='main' and s.day=day_cursor) into cache_exists;
   select * into old_job from public.ozon_finance_page_jobs j
    where j.account_key='main' and j.day=day_cursor for update;
   if not found then
      insert into public.ozon_finance_page_jobs
       (account_key,day,run_id,status,last_id,pages_completed,rows_saved,
        started_at,updated_at)
      values('main',day_cursor,gen_random_uuid(),'running','',0,0,now(),now());
      missing:=missing+1;
   elsif old_job.status='complete' and
      (not cache_exists or full_reconciliation or day_cursor>last_day-p_recent_refresh_days) then
      update public.ozon_finance_page_jobs set
        run_id=gen_random_uuid(),status='running',last_id='',
        pages_completed=0,rows_saved=0,lease_token=null,lease_until=null,
        last_error=null,started_at=now(),completed_at=null,updated_at=now()
      where account_key='main' and day=day_cursor;
      if cache_exists then refreshed:=refreshed+1;
      else missing:=missing+1; end if;
   elsif not cache_exists then
      missing:=missing+1;
   else
      busy:=busy+1;
   end if;
 end loop;
 update public.ozon_finance_schedule_runs set
  scheduled_missing=missing,scheduled_refresh=refreshed,
  skipped_in_progress=busy
 where local_date=p_local_date;
 return jsonb_build_object('ok',true,'already_planned',false,
   'local_date',p_local_date,'from',first_day,'to',last_day,
   'missing',missing,'refresh',refreshed,'already_cached',busy,
   'weekly_full_refresh',full_reconciliation);
end $$;
revoke all on function public.ozon_finance_schedule_window(date,integer,integer) from public,anon,authenticated;
grant execute on function public.ozon_finance_schedule_window(date,integer,integer) to service_role;
