-- Return only the live tasks that belong in the current user's quick panels.
-- Unassigned tasks are visible to their target department. Once taken, only
-- the employee who took the task can see it in the quick panels.
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
        'target_department', t.target_department,
        'assignee_id', coalesce(t.taken_by, t.assignee_id),
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
  where t.target_department = v_department
    and t.status <> 'completed'
    and (
      (
        t.assignee_id is null
        and t.taken_by is null
        and t.status = 'not_started'
      )
      or coalesce(t.taken_by, t.assignee_id) = v_uid
    );

  return jsonb_build_object(
    'user_id', v_uid,
    'department', v_department,
    'tasks', v_tasks
  );
end;
$fn$;

revoke all on function public.workspace_home_tasks_snapshot() from public, anon;
grant execute on function public.workspace_home_tasks_snapshot() to authenticated;
