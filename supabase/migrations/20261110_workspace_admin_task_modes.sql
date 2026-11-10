-- Idempotent source record of the Supabase migration.
CREATE OR REPLACE FUNCTION public.workspace_home_tasks_snapshot_v2(p_mode text DEFAULT 'work'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_full jsonb;
  v_tasks jsonb;
begin
  v_full:=public.workspace_tasks_snapshot_v2(p_mode);
  select coalesce(jsonb_agg(t.value),'[]'::jsonb) into v_tasks
    from jsonb_array_elements(v_full->'tasks') t(value)
    where t.value->>'status'<>'completed';
  return jsonb_build_object(
    'user_id',v_full->'user_id','mode',p_mode,
    'is_admin',v_full->'is_admin',
    'department',v_full->'department',
    'tasks',v_tasks,
    'admin_tasks',v_full->'admin_tasks',
    'notes',v_full->'notes');
end;
$function$


CREATE OR REPLACE FUNCTION public.workspace_task_action_v2(p_mode text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_marketplace text;
  v_admin text;
  v_department text;
  v_target text;
  v_title text;
  v_urgency text;
  v_comment text;
  v_id uuid;
  v_task public.workspace_tasks%rowtype;
  v_recipient uuid;
  v_actor_name text;
begin
  if v_uid is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
  if p_mode not in ('work','admin') or p_mode is null
    then raise exception 'Неизвестный режим задач' using errcode='22023'; end if;
  select a.system_role,a.category_marketplace,a.admin_level
    into v_role,v_marketplace,v_admin
    from public.app_user_access a where a.user_id=v_uid and a.is_blocked=false;
  if v_role is null then raise exception 'Рабочая роль не назначена' using errcode='42501'; end if;
  if p_mode='admin' and coalesce(v_admin,'none') not in ('admin','senior_admin')
    then raise exception 'Недостаточно прав администратора' using errcode='42501'; end if;
  v_department:=case when p_mode='admin' then 'admin'
    when v_role='category_manager' and v_marketplace is not null
      then 'category_manager:'||v_marketplace else v_role end;

  -- Private notes retain their existing owner-only implementation.
  if p_action in ('note_add','note_update','note_delete') then
    return public.workspace_task_action(p_action,p_payload);
  end if;

  -- Unchanged working actions keep existing semantics.
  if p_mode='work' and p_action<>'delete'
    and not (p_action='create' and p_payload->>'target_department'='admin') then
    return public.workspace_task_action(p_action,p_payload);
  end if;

  if p_action='create' then
    v_title:=btrim(coalesce(p_payload->>'title',''));
    v_urgency:=p_payload->>'urgency';
    v_target:=p_payload->>'target_department';
    v_comment:=coalesce(p_payload->>'comment','');
    if char_length(v_title) not between 1 and 500
      or v_urgency not in ('current','urgent','critical')
      or v_target is null or v_target not in (
        'admin','analyst','procurement','ved','marketing','manager','commercial_director',
        'category_manager','category_manager:ozon',
        'category_manager:wildberries','category_manager:yandex_market'
      ) or v_target=v_department or char_length(v_comment)>4000
      then raise exception 'Заполните задачу, срочность и отдел получателя' using errcode='22023';
    end if;
    insert into public.workspace_tasks(
      title,urgency,created_by,created_department,target_department,comment
    ) values (v_title,v_urgency,v_uid,v_department,v_target,v_comment)
      returning id into v_id;
    return jsonb_build_object('ok',true,'id',v_id);
  end if;

  if p_action not in ('delete','edit','comment','take','finish','cancel')
    then raise exception 'Неизвестное действие' using errcode='22023'; end if;
  v_id:=(p_payload->>'id')::uuid;
  select * into v_task from public.workspace_tasks where id=v_id for update;
  if not found then raise exception 'Задача не найдена' using errcode='42501'; end if;
  if v_task.cancelled_at is not null
    then raise exception 'Задача уже удалена' using errcode='42501'; end if;

  if p_action in ('delete','cancel') then
    if v_task.created_by<>v_uid then
      raise exception 'Удалить задачу может только её постановщик' using errcode='42501';
    end if;
    v_recipient:=coalesce(v_task.taken_by,v_task.assignee_id);
    if v_task.status='in_progress' and v_recipient is not null and v_recipient<>v_uid then
      select btrim(concat_ws(' ',p.first_name,p.last_name))
        into v_actor_name from public.app_profiles p where p.id=v_uid;
      insert into public.workspace_task_notifications(
        task_id,recipient_id,actor_id,actor_name,task_title
      ) values (
        v_task.id,v_recipient,v_uid,
        coalesce(nullif(v_actor_name,''),'Сотрудник'),v_task.title
      );
    end if;
    update public.workspace_tasks set
      cancelled_at=now(),cancelled_by=v_uid,updated_at=now() where id=v_id;
    return jsonb_build_object('ok',true);
  end if;

  if p_mode<>'admin' then
    raise exception 'Нет доступа к операции' using errcode='42501';
  end if;

  if p_action='edit' then
    if v_task.created_by<>v_uid or v_task.status<>'not_started' then
      raise exception 'Редактировать можно только свою непринятую задачу' using errcode='42501';
    end if;
    v_title:=btrim(coalesce(p_payload->>'title',v_task.title));
    v_urgency:=coalesce(p_payload->>'urgency',v_task.urgency);
    v_comment:=coalesce(p_payload->>'comment',v_task.comment);
    if char_length(v_title) not between 1 and 500
      or v_urgency not in ('current','urgent','critical') or char_length(v_comment)>4000
      then raise exception 'Некорректное содержимое задачи' using errcode='22023'; end if;
    update public.workspace_tasks
      set title=v_title,urgency=v_urgency,comment=v_comment,updated_at=now()
      where id=v_id;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='comment' then
    if v_task.created_by<>v_uid then
      raise exception 'Изменять чужую задачу нельзя' using errcode='42501'; end if;
    v_comment:=coalesce(p_payload->>'comment','');
    if char_length(v_comment)>4000 then
      raise exception 'Комментарий слишком длинный' using errcode='22023'; end if;
    update public.workspace_tasks
      set comment=v_comment,updated_at=now() where id=v_id;
    return jsonb_build_object('ok',true);
  end if;

  if v_task.target_department<>'admin' then
    raise exception 'Это задача другого отдела' using errcode='42501'; end if;

  if p_action='take' then
    if v_task.status='not_started' and v_task.taken_by is null then
      update public.workspace_tasks set
        status='in_progress',taken_by=v_uid,assignee_id=v_uid,
        started_at=now(),finished_at=null,updated_at=now() where id=v_id;
    elsif v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid then
      raise exception 'Задача уже взята другим администратором или завершена' using errcode='42501';
    end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='finish' then
    if v_task.status<>'in_progress' then
      raise exception 'Задача ещё не взята в работу или уже выполнена' using errcode='42501';
    end if;
    update public.workspace_tasks
      set status='completed',finished_at=now(),updated_at=now() where id=v_id;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'Неизвестное действие' using errcode='22023';
end;
$function$


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
        or (t.created_by=v_uid and t.created_department<>'admin')
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
$function$

revoke all on function public.workspace_tasks_snapshot_v2(text) from public,anon;
revoke all on function public.workspace_home_tasks_snapshot_v2(text) from public,anon;
revoke all on function public.workspace_task_action_v2(text,text,jsonb) from public,anon;
grant execute on function public.workspace_tasks_snapshot_v2(text) to authenticated,service_role;
grant execute on function public.workspace_home_tasks_snapshot_v2(text) to authenticated,service_role;
grant execute on function public.workspace_task_action_v2(text,text,jsonb) to authenticated,service_role;
