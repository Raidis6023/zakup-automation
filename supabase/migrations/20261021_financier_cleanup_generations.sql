create or replace function public.ozon_finance_cleanup_generations(p_day date,p_account text default 'main')
returns bigint
language plpgsql security invoker set search_path=public as $$
declare n bigint;
begin
 if current_user not in ('service_role','postgres') then
   raise exception 'Not authorized';
 end if;
 if not exists (
   select 1 from public.ozon_finance_page_jobs j
   join public.ozon_finance_sync_days d
      on d.account_key=j.account_key and d.day=j.day
      and d.active_run_id=j.run_id
   where j.account_key=p_account and j.day=p_day
     and j.status='complete'
 ) then return 0; end if;
 delete from public.ozon_finance_accruals a
 where a.account_key=p_account and a.day=p_day
   and a.run_id<>(select d.active_run_id from public.ozon_finance_sync_days d
      where d.account_key=p_account and d.day=p_day);
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function public.ozon_finance_cleanup_generations(date,text) from public,anon,authenticated;
grant execute on function public.ozon_finance_cleanup_generations(date,text) to service_role;
