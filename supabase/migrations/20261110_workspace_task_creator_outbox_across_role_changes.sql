-- Include tasks created by the current user in the working outbox
-- even when the creator's department or role has changed since creation.
-- The admin receiving department remains isolated from ordinary working inboxes.
CREATE OR REPLACE FUNCTION public.workspace_tasks_snapshot_v2(p_mode text DEFAULT 'work'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_marketplace text;
  v_admin text;
  v_department text;
  v_is_admin boolean;
  v_members jsonb;
  v_tasks jsonb;
  v_admin_tasks jsonb := '[]'::jsonb;
  v_notes jsonb;
begin
  if v_uid is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
  if p_mode not in ('work','admin') or p_mode is null
    then raise exception 'Неизвестный режим задач' using errcode='22023'; end if;
  select a.system_role,a.category_marketplace,a.admin_level
    into v_role,v_marketplace,v_admin
    from public.app_user_access a where a.user_id=v_uid and a.is_blocked=false;
  if v_role is null then raise exception 'Рабочая роль не назначена' using errcode='42501'; end if;
  v_is_admin := v_admin in ('admin','senior_admin');
  if p_mode='admin' and not v_is_admin then
    raise exception 'Недостаточно прав администратора' using errcode='42501';
  end if;
  v_department := case
    when p_mode='admin' then 'admin'
    when v_role='category_manager' and v_marketplace is not null
      then 'category_manager:'||v_marketplace
    else v_role end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',btrim(concat_ws(' ',p.first_name,p.last_name)),
    'department',case when a.system_role='category_manager' and a.category_marketplace is not null
      then 'category_manager:'||a.category_marketplace else a.system_role end
  ) order by p.last_name,p.first_name),'[]'::jsonb)
    into v_members
  from public.app_user_access a
  join public.app_profiles p on p.id=a.user_id
  where a.is_blocked=false and a.system_role is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'title',t.title,'urgency',t.urgency,
    'created_by',t.created_by,'created_department',t.created_department,
    'target_department',t.target_department,'assignee_id',t.assignee_id,
    'taken_by',t.taken_by,'status',t.status,'created_at',t.created_at,
    'started_at',t.started_at,'finished_at',t.finished_at,
    'comment',t.comment,'updated_at',t.updated_at,
    'creator_name',btrim(concat_ws(' ',pc.first_name,pc.last_name)),
    'assignee_name',nullif(btrim(concat_ws(' ',pa.first_name,pa.last_name)),'')
  ) order by t.created_at desc,t.id),'[]'::jsonb)
    into v_tasks
  from public.workspace_tasks t
  join public.app_profiles pc on pc.id=t.created_by
  left join public.app_profiles pa on pa.id=coalesce(t.taken_by,t.assignee_id)
  where t.cancelled_at is null
    and (
      (p_mode='admin' and (t.target_department='admin'
         or (t.created_by=v_uid and t.created_department='admin')))
      or
      (p_mode='work' and (
        t.target_department=v_department
        or (v_role='category_manager' and t.target_department='category_manager')
        or (t.created_by=v_uid)
      ))
    );

  if v_is_admin then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'title',t.title,'urgency',t.urgency,
      'created_by',t.created_by,'created_department',t.created_department,
      'target_department',t.target_department,'assignee_id',t.assignee_id,
      'taken_by',t.taken_by,'status',t.status,'created_at',t.created_at,
      'creator_name',btrim(concat_ws(' ',pc.first_name,pc.last_name)),
      'assignee_name',nullif(btrim(concat_ws(' ',pa.first_name,pa.last_name)),'')
    ) order by t.created_at desc,t.id),'[]'::jsonb)
      into v_admin_tasks
    from public.workspace_tasks t
    join public.app_profiles pc on pc.id=t.created_by
    left join public.app_profiles pa on pa.id=coalesce(t.taken_by,t.assignee_id)
    where t.cancelled_at is null and t.status<>'completed'
      and t.target_department='admin';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'title',n.title,'urgency',n.urgency,
    'remind_at',n.remind_at,'status',n.status,
    'created_at',n.created_at,'updated_at',n.updated_at
  ) order by n.created_at desc,n.id),'[]'::jsonb)
    into v_notes
  from public.workspace_task_notes n where n.owner_id=v_uid;

  return jsonb_build_object(
    'user_id',v_uid,'mode',p_mode,'is_admin',v_is_admin,
    'department',v_department,'members',v_members,
    'tasks',v_tasks,'admin_tasks',v_admin_tasks,'notes',v_notes);
end;
$function$;
