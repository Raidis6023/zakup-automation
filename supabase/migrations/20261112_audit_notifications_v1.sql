-- First release: immutable operational audit and recipient-scoped notification inbox.
-- Legacy business journals remain the source of truth and are queried on demand.
-- No passwords, integration keys, request payloads, or private note text enter the audit log.

create table if not exists public.app_audit_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  module text not null,
  action text not null,
  result text not null default 'success',
  actor_id uuid,
  object_type text not null,
  object_id text,
  title text not null,
  old_data jsonb,
  new_data jsonb,
  details jsonb not null default '{}'::jsonb
);
create index if not exists app_audit_events_created_idx on public.app_audit_events(created_at desc,id desc);
create index if not exists app_audit_events_module_created_idx on public.app_audit_events(module,created_at desc);
create index if not exists app_audit_events_actor_created_idx on public.app_audit_events(actor_id,created_at desc);
alter table public.app_audit_events enable row level security;
revoke all on public.app_audit_events from public, anon, authenticated;
revoke all on sequence public.app_audit_events_id_seq from public, anon, authenticated;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  kind text not null,
  category text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  body text not null default '',
  href text not null default '/',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  unique(recipient_id,dedupe_key)
);
create index if not exists app_notifications_inbox_idx on public.app_notifications(recipient_id,created_at desc) where dismissed_at is null;
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from public, anon, authenticated;

-- One read-only administrative feed. Historical sources are queried without
-- cloning them or exposing their raw tables to the browser.
create or replace function public.app_audit_feed(
  p_module text default null,
  p_result text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
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
$fn$;
revoke all on function public.app_audit_feed(text,text,timestamptz,timestamptz,text,integer,integer) from public,anon;
grant execute on function public.app_audit_feed(text,text,timestamptz,timestamptz,text,integer,integer) to authenticated,service_role;

create or replace function public.app_notifications_snapshot(p_limit integer default 80)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_json jsonb;
begin
  if v_user is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
  if p_limit<1 or p_limit>150 then raise exception 'Некорректный размер списка' using errcode='22023'; end if;
  if not exists (select 1 from public.app_user_access a where a.user_id=v_user and a.is_blocked=false) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'kind',n.kind,'category',n.category,'severity',n.severity,
    'title',n.title,'body',n.body,'href',n.href,
    'created_at',n.created_at,'read_at',n.read_at
  ) order by n.created_at desc),'[]'::jsonb)
  into v_json
  from (select * from public.app_notifications
    where recipient_id=v_user and dismissed_at is null
    order by created_at desc limit p_limit) n;
  return v_json;
end;
$fn$;
revoke all on function public.app_notifications_snapshot(integer) from public,anon;
grant execute on function public.app_notifications_snapshot(integer) to authenticated,service_role;

create or replace function public.app_notification_action(p_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = ''
as $fn$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
  if p_action not in ('read','dismiss') then raise exception 'Неизвестное действие' using errcode='22023'; end if;
  update public.app_notifications
    set read_at=coalesce(read_at,now()),
        dismissed_at=case when p_action='dismiss' then coalesce(dismissed_at,now()) else dismissed_at end
  where id=p_id and recipient_id=auth.uid();
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$fn$;
revoke all on function public.app_notification_action(uuid,text) from public,anon;
grant execute on function public.app_notification_action(uuid,text) to authenticated,service_role;

-- All notification writes below execute only from internal triggers or the scheduler.
create or replace function public.app_track_user_access()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_id uuid;
begin
  v_id:=coalesce(new.user_id,old.user_id);
  if tg_op='INSERT' or tg_op='DELETE' or
     old.system_role is distinct from new.system_role or
     old.admin_level is distinct from new.admin_level or
     old.is_blocked is distinct from new.is_blocked or
     old.category_marketplace is distinct from new.category_marketplace then
    insert into public.app_audit_events(module,action,actor_id,object_type,object_id,title,old_data,new_data)
    values('admin',lower(tg_op),auth.uid(),'employee',v_id::text,
      case when tg_op='INSERT' then 'Сотрудник добавлен'
           when tg_op='DELETE' then 'Сотрудник удалён'
           else 'Изменены права или статус сотрудника' end,
      case when tg_op='INSERT' then null else jsonb_build_object('role',old.system_role,'admin_level',old.admin_level,'blocked',old.is_blocked,'marketplace',old.category_marketplace) end,
      case when tg_op='DELETE' then null else jsonb_build_object('role',new.system_role,'admin_level',new.admin_level,'blocked',new.is_blocked,'marketplace',new.category_marketplace) end);
    if tg_op='UPDATE' and (old.system_role is distinct from new.system_role or
       old.admin_level is distinct from new.admin_level or old.is_blocked is distinct from new.is_blocked) then
      insert into public.app_notifications(recipient_id,kind,category,severity,title,body,href,dedupe_key)
      values(v_id,'access_changed','admin',case when new.is_blocked then 'warning' else 'info' end,
        'Изменены права доступа','Проверьте актуальные роли и статус учётной записи','/profile',
        'access:'||v_id::text||':'||coalesce(new.updated_at,now())::text)
      on conflict(recipient_id,dedupe_key) do nothing;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$fn$;
drop trigger if exists app_audit_user_access_trigger on public.app_user_access;
create trigger app_audit_user_access_trigger after insert or update or delete on public.app_user_access
for each row execute function public.app_track_user_access();
revoke all on function public.app_track_user_access() from public,anon,authenticated;

create or replace function public.app_track_access_request()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if tg_op='INSERT' or old.status is distinct from new.status then
    insert into public.app_audit_events(module,action,actor_id,object_type,object_id,title,old_data,new_data)
    values('admin','access_request_'||lower(tg_op),coalesce(new.reviewed_by,auth.uid()),
      'access_request',new.id::text,'Изменение заявки на доступ',
      case when tg_op='INSERT' then null else jsonb_build_object('status',old.status,'role',old.assigned_system_role) end,
      jsonb_build_object('status',new.status,'role',new.assigned_system_role));
    if tg_op='INSERT' then
      insert into public.app_notifications(recipient_id,kind,category,title,body,href,dedupe_key)
      select a.user_id,'access_request','admin','Новая заявка на доступ',
        'Поступила заявка на регистрацию','/admin/users',
        'access:request:'||new.id::text
      from public.app_user_access a
      where a.admin_level in ('admin','senior_admin') and a.is_blocked=false
      on conflict(recipient_id,dedupe_key) do nothing;
    end if;
    if tg_op='UPDATE' and new.approved_user_id is not null and old.status is distinct from new.status then
      insert into public.app_notifications(recipient_id,kind,category,title,body,href,dedupe_key)
      values(new.approved_user_id,'access_decision','admin','Изменён статус заявки на доступ',
        'Результат рассмотрения заявки: '||coalesce(new.status,'неизвестен'),'/profile',
        'access:decision:'||new.id::text||':'||coalesce(new.status,''))
      on conflict(recipient_id,dedupe_key) do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists app_audit_access_request_trigger on public.app_access_requests;
create trigger app_audit_access_request_trigger after insert or update on public.app_access_requests
for each row execute function public.app_track_access_request();
revoke all on function public.app_track_access_request() from public,anon,authenticated;

create or replace function public.app_track_task()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_kind text;
  v_title text;
  v_user uuid;
  v_task uuid;
begin
  v_task:=coalesce(new.id,old.id);
  if tg_op='INSERT' or tg_op='DELETE' or
     old.status is distinct from new.status or old.cancelled_at is distinct from new.cancelled_at or
     old.title is distinct from new.title or old.urgency is distinct from new.urgency or
     old.comment is distinct from new.comment then
    insert into public.app_audit_events(module,action,actor_id,object_type,object_id,title,old_data,new_data,details)
    values('tasks',lower(tg_op),auth.uid(),'task',v_task::text,
      case when tg_op='INSERT' then 'Задача поставлена'
           when tg_op='DELETE' then 'Задача удалена'
           when new.cancelled_at is not null and old.cancelled_at is null then 'Задача отменена'
           when new.status='completed' and old.status is distinct from new.status then 'Задача завершена'
           when new.status='in_progress' and old.status is distinct from new.status then 'Задача взята в работу'
           else 'Задача изменена' end,
      case when tg_op='INSERT' then null else jsonb_build_object('status',old.status,'urgency',old.urgency,'cancelled',old.cancelled_at is not null) end,
      case when tg_op='DELETE' then null else jsonb_build_object('status',new.status,'urgency',new.urgency,'cancelled',new.cancelled_at is not null) end,
      jsonb_build_object('target_department',coalesce(new.target_department,old.target_department),'created_by',coalesce(new.created_by,old.created_by)));
  end if;
  if tg_op='INSERT' then
    insert into public.app_notifications(recipient_id,kind,category,severity,title,body,href,dedupe_key)
    select a.user_id,'task_created','tasks',
      case when new.urgency='critical' then 'critical' when new.urgency='urgent' then 'warning' else 'info' end,
      'Новая задача для отдела','Поступила задача для '||new.target_department,'/tasks',
      'task:new:'||new.id::text
    from public.app_user_access a
    where a.is_blocked=false and a.user_id<>new.created_by
      and (
        (new.target_department='admin' and a.admin_level in ('admin','senior_admin'))
        or (new.target_department='category_manager' and a.system_role='category_manager')
        or (new.target_department like 'category_manager:%' and a.system_role='category_manager'
          and a.category_marketplace=split_part(new.target_department,':',2))
        or (new.target_department not in ('admin','category_manager') and
           new.target_department not like 'category_manager:%' and a.system_role=new.target_department)
      )
    on conflict(recipient_id,dedupe_key) do nothing;
  elsif tg_op='UPDATE' and (
    old.status is distinct from new.status or old.cancelled_at is distinct from new.cancelled_at
  ) then
    v_kind:=case when new.cancelled_at is not null and old.cancelled_at is null then 'task_cancelled'
       when new.status='in_progress' then 'task_taken'
       when new.status='completed' then 'task_completed'
       else null end;
    if v_kind is not null then
      v_title:=case v_kind when 'task_taken' then 'Задача взята в работу'
         when 'task_completed' then 'Задача завершена'
         else 'Задача отменена' end;
      insert into public.app_notifications(recipient_id,kind,category,title,body,href,dedupe_key)
      values(new.created_by,v_kind,'tasks',v_title,
        case when new.target_department='admin' then 'Администраторы' else new.target_department end,
        '/tasks','task:'||v_kind||':'||new.id::text)
      on conflict(recipient_id,dedupe_key) do nothing;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$fn$;
drop trigger if exists app_audit_task_trigger on public.workspace_tasks;
create trigger app_audit_task_trigger after insert or update or delete on public.workspace_tasks
for each row execute function public.app_track_task();
revoke all on function public.app_track_task() from public,anon,authenticated;

create or replace function public.app_track_sync()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if tg_op='INSERT' or old.status is distinct from new.status then
    insert into public.app_audit_events(module,action,result,object_type,object_id,title,new_data)
    values('sync','sync_state',case when new.status in ('failed','error') then 'error'
           when new.status ilike '%partial%' then 'warning' else 'success' end,
      'marketplace_sync',new.id::text,
      'Обновление синхронизации '||coalesce(new.marketplace,'маркетплейса'),
      jsonb_build_object('status',new.status,'failed_step',new.failed_step));
    if new.status in ('failed','error') or new.status ilike '%partial%' then
      insert into public.app_notifications(recipient_id,kind,category,severity,title,body,href,dedupe_key)
      select a.user_id,'sync_failure','sync',
        case when new.status in ('failed','error') then 'critical' else 'warning' end,
        'Ошибка загрузки '||coalesce(new.marketplace,'МП'),
        'Проверьте загрузку данных и историю синхронизации','/admin/logs',
        'sync:'||new.id::text||':'||new.status
      from public.app_user_access a
      where a.admin_level in ('admin','senior_admin') and a.is_blocked=false
      on conflict(recipient_id,dedupe_key) do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists app_audit_marketplace_sync_trigger on public.marketplace_daily_sync_runs;
create trigger app_audit_marketplace_sync_trigger after insert or update on public.marketplace_daily_sync_runs
for each row execute function public.app_track_sync();
revoke all on function public.app_track_sync() from public,anon,authenticated;

-- pg_cron delivers reminders even if the user is not browsing the app.
create or replace function public.app_emit_due_reminders()
returns integer language plpgsql security definer set search_path=''
as $fn$
declare v_inserted integer;
begin
  insert into public.app_notifications(recipient_id,kind,category,severity,title,body,href,dedupe_key)
  select n.owner_id,'note_reminder','notes',
    case when n.urgency='critical' then 'critical' when n.urgency='urgent' then 'warning' else 'info' end,
    'Напоминание','Наступило время личной заметки','/tasks',
    'note:due:'||n.id::text||':'||extract(epoch from n.remind_at)::bigint::text
  from public.workspace_task_notes n
  join public.app_user_access a on a.user_id=n.owner_id and a.is_blocked=false
  where n.remind_at <= now() and n.remind_at > now()-interval '30 days'
    and n.status<>'completed'
  on conflict(recipient_id,dedupe_key) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$fn$;
revoke all on function public.app_emit_due_reminders() from public,anon,authenticated;
grant execute on function public.app_emit_due_reminders() to service_role;

do $schedule$
begin
  if not exists(select 1 from cron.job where jobname='app-personal-notes-v1') then
    perform cron.schedule('app-personal-notes-v1','* * * * *',
      'select public.app_emit_due_reminders();');
  end if;
end;
$schedule$;

-- Never leak internal history through direct read policies or public function defaults.
