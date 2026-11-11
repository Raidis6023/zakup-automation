-- Preserve previously confirmed service categories omitted by a later provider workbook.
-- DO NOT mark missing sources as zero. Keep original source_report_id of carried rows.
-- For present categories, replace the day atomically and rebase line_index
-- above any retained rows. Rows from old and new reports retain provenance.
CREATE OR REPLACE FUNCTION public.finance_publish_yandex_daily(p_report_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r record;n integer;published integer;missing_sources text[];
begin
 perform pg_advisory_xact_lock(hashtext('finance_publish_yandex_daily'));
 select id,status,date_from,date_to,line_count,order_units_complete,error into r
 from public.yandex_finance_reports where id=p_report_id;
 if not found or r.status<>'ready' or r.order_units_complete is distinct from true
 then raise exception 'Yandex source not ready';end if;
 select count(*) into n from public.yandex_finance_lines where report_id=p_report_id;
 if n<>r.line_count then raise exception 'Yandex source incomplete';end if;

 -- The provider may omit an entire expense worksheet. Never delete earlier
 -- verified entries of that category merely because the new workbook lacks it.
 missing_sources:=string_to_array(
  split_part(split_part(coalesce(r.error,''),'ЯМ не включил листы услуг: ',2),
   '. Их суммы',1),'; ');

 -- Replace a stream only on actual populated days of that stream.
 -- For days missing from a new report the preceding published history survives.
 delete from public.yandex_finance_daily_lines d
 where d.snapshot_day in (
  select distinct substring(coalesce(nullif(l.payload->>'serviceDate',''),nullif(l.payload->>'orderDate','')) from 1 for 10)::date
  from public.yandex_finance_lines l where l.report_id=p_report_id
 )
 and not (
  (d.payload->>'sheet')=any(missing_sources)
  and not exists(
   select 1 from public.yandex_finance_lines newer
   where newer.report_id=p_report_id
     and newer.payload->>'sheet'=d.payload->>'sheet'
  )
 );
 insert into public.yandex_finance_daily_lines(snapshot_day,line_index,payload,source_report_id)
 select d.day,(coalesce((select max(kept.line_index)+1
    from public.yandex_finance_daily_lines kept where kept.snapshot_day=d.day),0)
    +row_number() over(partition by d.day order by l.line_index)-1)::integer,
   l.payload,p_report_id
 from public.yandex_finance_lines l
 cross join lateral (
  select substring(coalesce(nullif(l.payload->>'serviceDate',''),nullif(l.payload->>'orderDate','')) from 1 for 10)::date as day
 ) d
 where l.report_id=p_report_id and d.day between r.date_from and r.date_to;
 delete from public.yandex_finance_daily_orders d
 where d.snapshot_day in (
  select distinct order_date from public.yandex_finance_order_quantities
  where report_id=p_report_id
 );
 insert into public.yandex_finance_daily_orders
 (snapshot_day,order_id,item_id,article,name,quantity,status,in_transit_quantity,realization_total_cents,source_report_id)
 select order_date,order_id,item_id,article,name,quantity,status,in_transit_quantity,realization_total_cents,p_report_id
 from public.yandex_finance_order_quantities
 where report_id=p_report_id and order_date between r.date_from and r.date_to;
 insert into public.yandex_finance_daily_snapshots
 (snapshot_day,source_report_id,line_count,order_count,captured_at)
 select d.day,p_report_id,
 (select count(*)::integer from public.yandex_finance_daily_lines where snapshot_day=d.day),
 (select count(*)::integer from public.yandex_finance_daily_orders where snapshot_day=d.day),now()
 from (
  select snapshot_day as day from public.yandex_finance_daily_lines where source_report_id=p_report_id
  union
  select snapshot_day as day from public.yandex_finance_daily_orders where source_report_id=p_report_id
 ) d
 on conflict(snapshot_day) do update set
 source_report_id=excluded.source_report_id,line_count=excluded.line_count,
 order_count=excluded.order_count,captured_at=excluded.captured_at;
 get diagnostics published=row_count;return published;
end $function$
