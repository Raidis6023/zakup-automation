-- Procurement reads saved, daily marketplace exports. No direct WB Statistics request.
-- The existing Yandex yandex_sales_daily is deliberately reused (verified successful sync).
create or replace function public.china_import_wb_sales_from_daily()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $china$
declare
  v_job public.wb_finance_cache_jobs%rowtype;
  v_from date;
  v_to date;
  v_finance_rows integer;
  v_matched_days integer;
  v_fbw_sales integer;
  v_fbw_returns integer;
  v_without_order integer;
  v_saved integer;
  v_recent public.wb_sales_import_runs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('china_import_wb_sales_from_daily'));

  select * into v_job
  from public.wb_finance_cache_jobs j
  where j.status='complete'
    and j.completed_at >= now() - interval '48 hours'
    and j.rows_saved > 0
  order by j.completed_at desc, j.run_day desc limit 1;
  if v_job.run_day is null then
    raise exception 'Закуп: нет свежей завершённой ежедневной финансовой выгрузки WB';
  end if;

  select count(*) into v_finance_rows
  from public.wb_finance_cache_lines l where l.run_day=v_job.run_day;
  if v_finance_rows <> v_job.rows_saved then
    raise exception 'Закуп: отчёт WB записан не полностью (% из %)', v_finance_rows,v_job.rows_saved;
  end if;

  -- Use the latest shared 28-day interval with actually recorded WB events,
  -- a confirmed Yandex sales sync, and the authoritative Ozon window.
  select o.date_from,o.date_to into v_from,v_to
  from public.ozon_sales_sync_runs o
  where o.status='success'
    and o.completed_days=28
    and o.date_to-o.date_from=27
    and o.date_from >= v_job.date_from
    and o.date_to <= v_job.date_to
    and o.date_to >= (now() at time zone 'Asia/Krasnoyarsk')::date - 2
    and exists (
      select 1 from public.yandex_sales_sync_runs y
      where y.status='success'
        and y.date_from=o.date_from
        and y.date_to=o.date_to
        and y.unmatched_order_items=0
        and y.unmatched_return_items=0
        and y.finished_at >= now() - interval '72 hours'
    )
    and (
      select count(distinct ((l.payload->>'saleDt')::timestamptz
                             at time zone 'Europe/Moscow')::date)
      from public.wb_finance_cache_lines l
      where l.run_day=v_job.run_day
        and l.payload->>'docTypeName' in ('Продажа','Возврат')
        and l.payload->>'sellerOperName' in ('Продажа','Возврат')
        and ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::date
            between o.date_from and o.date_to
    ) = 28
  order by o.date_to desc,o.created_at desc limit 1;

  if v_from is null then
    raise exception 'Закуп: нет общего полного 28-дневного периода Ozon, WB и Яндекс Маркета. Финансовый отчёт WB может приходить с задержкой.';
  end if;

  select * into v_recent
  from public.wb_sales_import_runs i
  where i.status='success'
    and i.date_from=v_from and i.date_to=v_to
    and i.completed_at > now()-interval '4 hours'
    and i.error is null
  order by i.completed_at desc limit 1;
  if v_recent.id is not null then
    return jsonb_build_object('ok',true,'skipped',true,
      'source','wb_finance_daily','dateFrom',v_from,'dateTo',v_to,
      'rowsSaved',v_recent.rows_saved,'fbwSales',v_recent.fbw_sales,
      'fbwReturns',v_recent.fbw_returns);
  end if;

  -- Check FBW coverage and mapping before importing any data.
  with operations as materialized (
    select
      l.payload as payload,
      ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::timestamp as sale_time,
      o.srid as matched_order_srid,
      o.warehouse_type
    from public.wb_finance_cache_lines l
    left join public.wb_orders o on o.srid=l.payload->>'srid'
    where l.run_day=v_job.run_day
      and l.payload->>'docTypeName' in ('Продажа','Возврат')
      and l.payload->>'sellerOperName' in ('Продажа','Возврат')
      and ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::date
          between v_from and v_to
  )
  select count(distinct sale_time::date),
         count(*) filter(where payload->>'sellerOperName'='Продажа'),
         count(*) filter(where payload->>'sellerOperName'='Возврат'),
         count(*) filter(where matched_order_srid is null)
    into v_matched_days,v_fbw_sales,v_fbw_returns,v_without_order
  from operations
  where warehouse_type='Склад WB'
     or (matched_order_srid is null and payload->>'officeName'='Склад WB');

  if v_matched_days <> 28 or v_fbw_sales < 1 then
    raise exception 'Закуп: FBW-продажи из ежедневной выгрузки неполные: % дней вместо 28',coalesce(v_matched_days,0);
  end if;

  -- rrdId identifies a single financial operation. Stable SFIN/RFIN IDs
  -- prevent double counting on repeated imports, without changing source rows.
  insert into public.wb_sales
    (sale_id,srid,sale_date,last_change_date,nm_id,supplier_article,
     barcode,warehouse_name,warehouse_type,income_id,raw,synced_at)
  select
    case when l.payload->>'sellerOperName'='Продажа' then 'SFIN:' else 'RFIN:' end ||
       (l.payload->>'rrdId'),
    l.payload->>'srid',
    ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::timestamp,
    ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::timestamp,
    (l.payload->>'nmId')::bigint,
    l.payload->>'vendorCode',
    l.payload->>'sku',
    l.payload->>'officeName',
    'Склад WB',
    nullif(l.payload->>'giId','')::bigint,
    jsonb_build_object('source','wb_finance_daily','finance_run_day',v_job.run_day,
       'rrdId',l.payload->>'rrdId','order_match',o.srid is not null),
    now()
  from public.wb_finance_cache_lines l
  left join public.wb_orders o on o.srid=l.payload->>'srid'
  where l.run_day=v_job.run_day
    and l.payload->>'docTypeName' in ('Продажа','Возврат')
    and l.payload->>'sellerOperName' in ('Продажа','Возврат')
    and ((l.payload->>'saleDt')::timestamptz at time zone 'Europe/Moscow')::date
        between v_from and v_to
    and (o.warehouse_type='Склад WB'
      or (o.srid is null and l.payload->>'officeName'='Склад WB'))
    and l.payload->>'rrdId' ~ '^[0-9]+$'
    and l.payload->>'nmId' ~ '^[0-9]+$'
  on conflict (sale_id) do update set
    srid=excluded.srid,
    sale_date=excluded.sale_date,
    last_change_date=excluded.last_change_date,
    nm_id=excluded.nm_id,
    supplier_article=excluded.supplier_article,
    barcode=excluded.barcode,
    warehouse_name=excluded.warehouse_name,
    warehouse_type=excluded.warehouse_type,
    income_id=excluded.income_id,
    raw=excluded.raw,
    synced_at=excluded.synced_at;

  get diagnostics v_saved = row_count;
  if v_saved <> v_fbw_sales + v_fbw_returns then
    raise exception 'Закуп: сохранено % операций WB вместо %',v_saved,v_fbw_sales+v_fbw_returns;
  end if;

  insert into public.wb_sales_import_runs
    (date_from,date_to,status,started_at,completed_at,rows_received,
     rows_saved,fbw_sales,fbw_returns,error)
  values
    (v_from,v_to,'success',now(),now(),v_finance_rows,
     v_saved,v_fbw_sales,v_fbw_returns,null);

  return jsonb_build_object('ok',true,'source','wb_finance_daily',
    'dateFrom',v_from,'dateTo',v_to,'rowsReceived',v_finance_rows,
    'rowsSaved',v_saved,'fbwSales',v_fbw_sales,'fbwReturns',v_fbw_returns,
    'unmatchedFbwOperations',v_without_order,'skipped',false);
end;
$china$;

revoke execute on function public.china_import_wb_sales_from_daily()
  from public,anon,authenticated;
grant execute on function public.china_import_wb_sales_from_daily()
  to service_role;

-- Preserve the v9 formulas, but require the SAME successful daily source for
-- every marketplace and avoid counting old supplier/sales rows twice.
do $patch$
declare
  definition text;
  anchor text;
  updated text;
begin
  select replace(pg_get_functiondef(p.oid),E'\r\n',E'\n') into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='run_china_calculation_v9_preview';
  if definition is null then raise exception 'China v9 function not found'; end if;

  anchor := 'AND r.date_to - r.date_from + 1 = 28';
  if position(anchor in definition)=0 then
    raise exception 'Expected v9 period selector missing';
  end if;
  updated := replace(definition,anchor,
    anchor || $checks$
      AND r.date_to >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
      AND EXISTS (
        SELECT 1 FROM public.wb_sales_import_runs w
        WHERE w.status='success'
          AND w.date_from<=r.date_from AND w.date_to>=r.date_to
          AND w.completed_at>=now()-interval '36 hours'
      )
      AND EXISTS (
        SELECT 1 FROM public.yandex_sales_sync_runs y
        WHERE y.status='success'
          AND y.date_from=r.date_from AND y.date_to=r.date_to
          AND y.unmatched_order_items=0 AND y.unmatched_return_items=0
          AND y.finished_at>=now()-interval '72 hours'
      )
$checks$);
  if updated=definition then raise exception 'Unable to patch period selection'; end if;
  definition := updated;

  -- The former WB supplier/sales entries remain historical, but are not
  -- mixed with financial SFIN/RFIN operations in current China forecasts.
  anchor := 'FROM public.wb_sales s';
  updated := replace(definition,anchor,anchor || E'\n' ||
    '        -- Only verified daily financial WB export is valid for procurement.');
  if updated=definition then raise exception 'Missing WB table in v9'; end if;
  definition:=updated;

  anchor := 'WHERE s.warehouse_type = ''Склад WB''';
  updated := replace(definition,anchor,
    anchor || E'\n' || '           AND s.raw->>''source'' = ''wb_finance_daily''');
  if updated=definition then raise exception 'WB filter not found'; end if;
  definition:=updated;

  anchor := 'FROM public.wb_sales' || E'\n' || '        WHERE sale_date::date';
  updated := replace(definition,anchor,
    'FROM public.wb_sales' || E'\n' ||
    '        WHERE raw->>''source'' = ''wb_finance_daily''' || E'\n' ||
    '          AND sale_date::date');
  if updated=definition then raise exception 'WB readiness filter not found'; end if;
  definition:=updated;

  execute definition;
end;
$patch$;
