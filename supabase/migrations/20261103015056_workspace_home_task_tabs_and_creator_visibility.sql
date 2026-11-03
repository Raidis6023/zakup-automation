-- Expand the home task snapshot for the four right-panel tabs.
-- Authors retain visibility of their own cross-department tasks after switching roles.
create or replace function public.workspace_home_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_marketplace text;
  v_department text;
  v_tasks jsonb;
  v_notes jsonb;
begin
  if v_uid is null then
    raise exception 'Требуется авторизация' using errcode='42501';
  end if;

  select a.system_role, a.category_marketplace
    into v_role, v_marketplace
  from public.app_user_access a
  where a.user_id = v_uid
    and a.is_blocked = false;

  if v_role is null then
    raise exception 'Рабочая роль не назначена' using errcode='42501';
  end if;

  v_department := case
    when v_role = 'category_manager' and v_marketplace is not null
      then 'category_manager:' || v_marketplace
    else v_role
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'urgency', t.urgency,
        'created_by', t.created_by,
        'created_department', t.created_department,
        'target_department', t.target_department,
        'assignee_id', t.assignee_id,
        'taken_by', t.taken_by,
        'status', t.status,
        'created_at', t.created_at,
        'creator_name', btrim(concat_ws(' ', pc.first_name, pc.last_name)),
        'assignee_name', nullif(btrim(concat_ws(' ', pa.first_name, pa.last_name)), '')
      )
      order by t.created_at desc, t.id
    ),
    '[]'::jsonb
  )
  into v_tasks
  from public.workspace_tasks t
  join public.app_profiles pc on pc.id = t.created_by
  left join public.app_profiles pa
    on pa.id = coalesce(t.taken_by, t.assignee_id)
  where t.status <> 'completed'
    and (
      (
        (
          t.target_department = v_department
          or (
            v_role = 'category_manager'
            and t.target_department = 'category_manager'
          )
        )
        and t.status = 'not_started'
        and t.taken_by is null
      )
      or (
        t.status = 'in_progress'
        and (
          t.taken_by = v_uid
          or t.assignee_id = v_uid
        )
      )
      or (
        t.created_by = v_uid
        and t.created_department is distinct from t.target_department
      )
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'title', n.title,
        'urgency', n.urgency,
        'remind_at', n.remind_at,
        'status', n.status,
        'created_at', n.created_at
      )
      order by n.created_at desc, n.id
    ),
    '[]'::jsonb
  )
  into v_notes
  from public.workspace_task_notes n
  where n.owner_id = v_uid;

  return jsonb_build_object(
    'user_id', v_uid,
    'department', v_department,
    'tasks', v_tasks,
    'notes', v_notes
  );
end;
$fn$;

revoke all on function public.workspace_home_tasks_snapshot() from public, anon;
grant execute on function public.workspace_home_tasks_snapshot() to authenticated;
