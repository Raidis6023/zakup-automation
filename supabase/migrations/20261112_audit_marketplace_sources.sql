-- Connect actual Ozon and Wildberries ingestion journals to the admin feed.
-- Snapshot tables are grouped per run/day, never one event per SKU.
-- A scheduled/running job must never be shown as a completed import.

CREATE OR REPLACE FUNCTION public.app_audit_feed(p_module text DEFAULT NULL::text, p_result text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin_level text;
  v_result jsonb;
begin
  select a.admin_level into v_admin_level
  from public.app_user_access a
  where a.user_id=auth.uid() and a.is_blocked=false;
  if v_admin_level not in ('admin','senior_admin') or v_admin_level is null then
    raise exception 'Недостаточно прав для просмотра истории' using errcode='42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 or p_offset > 100000 then
    raise exception 'Некорректная пагинация' using errcode='22023';
  end if;
  with unified as (
    select ('audit:'||e.id::text) id, e.created_at,
      e.module,e.action,e.result,e.actor_id,e.object_type,e.object_id,e.title,
      e.old_data,e.new_data,e.details
    from public.app_audit_events e
    union all
    select ('ved:'||v.id::text),v.created_at,'ved',v.event_type,'success',
      v.actor_user_id,'ved_order',v.ved_order_id::text,
      'ВЭД · '||replace(v.event_type,'_',' '),
      v.old_value,v.new_value,
      jsonb_strip_nulls(jsonb_build_object('field',v.field_name,'reason',left(v.reason,300)))
    from public.ved_order_audit_log v
    union all
    select ('ym_rate:'||y.id::text),y.changed_at,'finance','rate_changed','success',
      y.actor_id,'master_code',y.master_code,
      'Яндекс Маркет · изменение ставки',y.old_value,y.new_value,
      jsonb_build_object('effective_from',y.valid_from)
    from public.yandex_finance_rate_audit y
    union all
    select ('tariff:'||t.id::text),t.created_at,'ved','tariff_changed','success',
      t.actor_user_id,'ved_tariff',t.tariff_key,
      'ВЭД · изменение тарифа',null,
      jsonb_build_object('amount',t.amount,'effective_from',t.effective_from),
      jsonb_build_object('reason',left(t.reason,300))
    from public.ved_tariff_history t
    union all
    select ('unit:'||h.id::text),h.created_at,'calculations','calculation_version',
      case when h.status ilike '%error%' or h.status ilike '%fail%' then 'error' else 'success' end,
      null::uuid,'unit_calculation',h.product_id::text,
      'Юнит-экономика · версия расчёта',null,
      jsonb_build_object('model',h.model,'status',h.status,'revision',h.settings_revision),
      jsonb_build_object('source_type',h.source_type)
    from public.unit_ved_history h
    union all
    select ('sync:'||s.id::text),coalesce(s.finished_at,s.started_at,s.created_at),
      'sync','marketplace_sync',
      case when s.status in ('failed','error') then 'error'
           when s.status ilike '%partial%' then 'warning'
           else 'success' end,
      null::uuid,'marketplace_sync',s.id::text,
      'Синхронизация · '||coalesce(s.marketplace,'МП')||' · '||coalesce(s.status,''),
      null,jsonb_build_object('status',s.status,'duration_ms',s.duration_ms),
      jsonb_strip_nulls(jsonb_build_object('failed_step',s.failed_step))
    from public.marketplace_daily_sync_runs s
    union all
    select ('ozon:sales:'||s.id::text),s.created_at,
      'sync','ozon_sales',case when s.status='success' then 'success'
        when s.status in ('failed','error') then 'error' else 'pending' end,
      null::uuid,'ozon_sales',s.id::text,'Ozon · обновление продаж',
      null,jsonb_build_object('status',s.status,'from',s.date_from,'to',s.date_to,
        'days',s.completed_days,'postings',s.postings_received,
        'rows',s.aggregated_rows_saved), '{}'::jsonb
    from public.ozon_sales_sync_runs s
    union all
    select ('ozon:stocks:'||s.snapshot_date::text),max(s.imported_at),
      'sync','ozon_stocks','success',
      null::uuid,'ozon_stocks',s.snapshot_date::text,'Ozon · снимок остатков',
      null,jsonb_build_object('date',s.snapshot_date,'rows',count(*)),
      '{}'::jsonb
    from public.ozon_stock_snapshots s
    group by s.snapshot_date
    union all
    select ('wb:sales:'||s.id::text),coalesce(s.completed_at,s.started_at),
      'sync','wb_sales',case when s.status='success' then 'success'
        when s.status in ('failed','error') then 'error' else 'pending' end,
      null::uuid,'wb_sales',s.id::text,'Wildberries · импорт продаж',
      null,jsonb_build_object('status',s.status,'from',s.date_from,'to',s.date_to,
        'rows',s.rows_saved,'received',s.rows_received,
        'fbw_sales',s.fbw_sales,'fbw_returns',s.fbw_returns),
      '{}'::jsonb
    from public.wb_sales_import_runs s
    union all
    select ('wb:stocks:'||s.snapshot_id::text),max(s.snapshot_at),
      'sync','wb_stocks','success',
      null::uuid,'wb_stocks',s.snapshot_id::text,'Wildberries · снимок остатков',
      null,jsonb_build_object('date',max(s.snapshot_at)::date,'products',count(*)),
      '{}'::jsonb
    from public.wb_stock_product_snapshots s
    group by s.snapshot_id
    union all
    select ('wb:finance:'||s.run_day::text),coalesce(s.completed_at,s.updated_at),
      'sync','wb_finance',case when s.status='complete' then 'success' else 'error' end,
      null::uuid,'wb_finance',s.run_day::text,'Wildberries · финансовая выгрузка',
      null,jsonb_build_object('status',s.status,'date',s.run_day,
        'from',s.date_from,'to',s.date_to,'rows',s.rows_saved), '{}'::jsonb
    from public.wb_finance_cache_jobs s
    where s.status='complete' or s.status in ('failed','error')
    union all
    select ('ozon:fin:'||s.account_key||':'||s.day::text),
      coalesce(s.completed_at,s.updated_at),
      'sync','ozon_finance',case when s.status='complete' then 'success' else 'error' end,
      null::uuid,'ozon_finance',s.account_key||':'||s.day::text,
      'Ozon · загрузка начислений',
      null,jsonb_build_object('status',s.status,'day',s.day,'rows',s.rows_saved,
        'pages',s.pages_completed), '{}'::jsonb
    from public.ozon_finance_page_jobs s
    where s.status in ('complete','failed','error')
    union all
    select ('ozon:ads:'||s.id::text),s.updated_at,
      'sync','ozon_ads',case when s.status='complete' then 'success' else 'error' end,
      null::uuid,'ozon_ads',s.id::text,'Ozon · загрузка рекламы',
      null,jsonb_build_object('status',s.status,'from',s.date_from,'to',s.date_to),
      '{}'::jsonb
    from public.ozon_finance_ad_sync_jobs s
    where s.status in ('complete','failed','error')
  ),
  visible as (
    select u.*, 
      case when u.module='admin' and v_admin_level<>'senior_admin'
        then 'Администраторы'
        when u.actor_id is null then 'Система'
        else coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
                      'Сотрудник')
      end actor_name
    from unified u
    left join public.app_profiles p on p.id=u.actor_id
    where (p_module is null or p_module='' or p_module='all' or
        (p_module='data' and u.module in ('ved','finance','calculations')) or
        (p_module='error' and u.result='error') or
        (p_module not in ('data','error') and u.module=p_module))
      and (p_result is null or p_result='' or p_result='all' or u.result=p_result)
      and (p_from is null or u.created_at>=p_from)
      and (p_to is null or u.created_at<p_to)
      and (p_search is null or p_search='' or
        u.title ilike '%'||left(p_search,100)||'%' or
        coalesce(u.object_id,'') ilike '%'||left(p_search,100)||'%' or
        coalesce(u.object_type,'') ilike '%'||left(p_search,100)||'%' or
        coalesce(concat_ws(' ',p.first_name,p.last_name),'') ilike '%'||left(p_search,100)||'%')
  ),
  total as (select count(*) cnt from visible),
  page as (select * from visible order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object(
    'total',(select cnt from total),
    'items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$
;
