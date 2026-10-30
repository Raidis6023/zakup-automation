-- Day-level publication from fully completed source reports, one database transaction.
create or replace function public.finance_publish_yandex_daily(p_report_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare r record; n integer; published integer;
begin
 select id,status,date_from,date_to,line_count,order_units_complete into r
 from public.yandex_finance_reports where id=p_report_id;
 if not found or r.status<>'ready' or r.order_units_complete is distinct from true then raise exception 'Yandex source not ready'; end if;
 select count(*) into n from public.yandex_finance_lines where report_id=p_report_id;
 if n<>r.line_count then raise exception 'Yandex source incomplete'; end if;
 delete from public.yandex_finance_daily_lines where snapshot_day between r.date_from and r.date_to;
 delete from public.yandex_finance_daily_orders where snapshot_day between r.date_from and r.date_to;
 insert into public.yandex_finance_daily_lines(snapshot_day,line_index,payload,source_report_id)
 select d.day,(row_number() over(partition by d.day order by l.line_index)-1)::integer,l.payload,p_report_id
 from public.yandex_finance_lines l
 cross join lateral (select substring(coalesce(nullif(l.payload->>'serviceDate',''),nullif(l.payload->>'orderDate','')) from 1 for 10)::date as day) d
 where l.report_id=p_report_id and d.day between r.date_from and r.date_to;
 insert into public.yandex_finance_daily_orders(snapshot_day,order_id,item_id,article,name,quantity,status,in_transit_quantity,realization_total_cents,source_report_id)
 select order_date,order_id,item_id,article,name,quantity,status,in_transit_quantity,realization_total_cents,p_report_id
 from public.yandex_finance_order_quantities where report_id=p_report_id and order_date between r.date_from and r.date_to;
 insert into public.yandex_finance_daily_snapshots(snapshot_day,source_report_id,line_count,order_count,captured_at)
 select d.day,p_report_id,coalesce(l.n,0),coalesce(o.n,0),now()
 from generate_series(r.date_from,r.date_to,interval '1 day') d(day)
 left join lateral (select count(*)::integer n from public.yandex_finance_daily_lines where snapshot_day=d.day) l on true
 left join lateral (select count(*)::integer n from public.yandex_finance_daily_orders where snapshot_day=d.day) o on true
 on conflict(snapshot_day) do update set source_report_id=excluded.source_report_id,line_count=excluded.line_count,order_count=excluded.order_count,captured_at=excluded.captured_at;
 get diagnostics published=row_count;
 return published;
end $$;
revoke all on function public.finance_publish_yandex_daily(uuid) from public,anon,authenticated;
grant execute on function public.finance_publish_yandex_daily(uuid) to service_role;

create or replace function public.finance_publish_wb_daily(p_run_day date)
returns integer language plpgsql security invoker set search_path=public as $$
declare r record; n integer; published integer;
begin
 select run_day,date_from,date_to,rows_saved,status into r from public.wb_finance_cache_jobs where run_day=p_run_day;
 if not found or r.status<>'complete' then raise exception 'WB source not complete'; end if;
 select count(*) into n from public.wb_finance_cache_lines where run_day=p_run_day;
 if n<>r.rows_saved then raise exception 'WB source incomplete'; end if;
 delete from public.wb_finance_daily_lines where snapshot_day between r.date_from and r.date_to;
 insert into public.wb_finance_daily_lines(snapshot_day,line_index,payload,source_run_day)
 select d.day,(row_number() over(partition by d.day order by l.line_index)-1)::integer,l.payload,p_run_day
 from public.wb_finance_cache_lines l
 cross join lateral (select substring(coalesce(nullif(l.payload->>'rrDate',''),nullif(l.payload->>'rrdDt',''),nullif(l.payload->>'rrdDate',''),nullif(l.payload->>'saleDt','')) from 1 for 10)::date day) d
 where l.run_day=p_run_day and d.day between r.date_from and r.date_to;
 insert into public.wb_finance_daily_snapshots(snapshot_day,source_run_day,line_count,captured_at)
 select d.day,p_run_day,(select count(*)::integer from public.wb_finance_daily_lines where snapshot_day=d.day),now()
 from generate_series(r.date_from,r.date_to,interval '1 day') d(day)
 on conflict(snapshot_day) do update set source_run_day=excluded.source_run_day,line_count=excluded.line_count,captured_at=excluded.captured_at;
 get diagnostics published=row_count;
 return published;
end $$;
revoke all on function public.finance_publish_wb_daily(date) from public,anon,authenticated;
grant execute on function public.finance_publish_wb_daily(date) to service_role;
