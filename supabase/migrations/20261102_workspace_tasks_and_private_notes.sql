
-- Workspace task board: separate cross-department tasks and private reminders.
create table if not exists public.workspace_tasks (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 1 and 500),
 urgency text not null check (urgency in ('current','urgent','critical')),
 created_by uuid not null references public.app_profiles(id),
 created_department text not null,
 target_department text not null check (target_department <> created_department),
 assignee_id uuid references public.app_profiles(id),
 taken_by uuid references public.app_profiles(id),
 status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
 created_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 comment text not null default '' check (char_length(comment) <= 4000),
 updated_at timestamptz not null default now()
);
create index if not exists workspace_tasks_recipient_idx on public.workspace_tasks (target_department, created_at desc);
create index if not exists workspace_tasks_creator_idx on public.workspace_tasks (created_by, created_at desc);

create table if not exists public.workspace_task_notes (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.app_profiles(id),
 title text not null check (char_length(btrim(title)) between 1 and 500),
 urgency text not null default 'current' check (urgency in ('current','urgent','critical')),
 remind_at timestamptz,
 status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists workspace_task_notes_owner_idx on public.workspace_task_notes (owner_id, remind_at);

alter table public.workspace_tasks enable row level security;
alter table public.workspace_task_notes enable row level security;
revoke all on table public.workspace_tasks, public.workspace_task_notes from anon, authenticated;

-- Explicitly authenticated RPCs are the only data access point. This keeps
-- cross-department visibility separate from edit rights and private reminders.
create or replace function public.workspace_tasks_snapshot()
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
 v_members jsonb;
 v_tasks jsonb;
 v_notes jsonb;
begin
 if v_uid is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 select a.system_role,a.category_marketplace into v_role,v_marketplace
 from public.app_user_access a where a.user_id=v_uid and a.is_blocked=false;
 if v_role is null then raise exception 'Рабочая роль не назначена' using errcode='42501'; end if;
 v_department := case when v_role='category_manager' and v_marketplace is not null
   then 'category_manager:' || v_marketplace else v_role end;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id', p.id,
   'name', btrim(concat_ws(' ',p.first_name,p.last_name)),
   'department',case when a.system_role='category_manager' and a.category_marketplace is not null
     then 'category_manager:'||a.category_marketplace else a.system_role end
 ) order by p.last_name,p.first_name),'[]'::jsonb) into v_members
 from public.app_user_access a join public.app_profiles p on p.id=a.user_id
 where a.is_blocked=false and a.system_role is not null;

 select coalesce(jsonb_agg(
 jsonb_build_object(
  'id',t.id,'title',t.title,'urgency',t.urgency,'created_by',t.created_by,
  'created_department',t.created_department,'target_department',t.target_department,
  'assignee_id',t.assignee_id,'taken_by',t.taken_by,'status',t.status,
  'created_at',t.created_at,'started_at',t.started_at,'finished_at',t.finished_at,
  'comment',t.comment,'updated_at',t.updated_at,
  'creator_name',btrim(concat_ws(' ',pc.first_name,pc.last_name)),
  'assignee_name',nullif(btrim(concat_ws(' ',pa.first_name,pa.last_name)),'')
 ) order by t.created_at desc,t.id),'[]'::jsonb) into v_tasks
 from public.workspace_tasks t
 join public.app_profiles pc on pc.id=t.created_by
 left join public.app_profiles pa on pa.id=t.assignee_id;

 select coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'title',n.title,'urgency',n.urgency,
  'remind_at',n.remind_at,'status',n.status,
  'created_at',n.created_at,'updated_at',n.updated_at
 ) order by n.created_at desc,n.id),'[]'::jsonb) into v_notes
 from public.workspace_task_notes n where n.owner_id=v_uid;

 return jsonb_build_object('user_id',v_uid,'department',v_department,
   'members',v_members,'tasks',v_tasks,'notes',v_notes);
end;
$fn$;

create or replace function public.workspace_task_action(p_action text,p_payload jsonb default '{}'::jsonb)
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
 v_target text;
 v_title text;
 v_urgency text;
 v_comment text;
 v_status text;
 v_id uuid;
 v_assignee uuid;
 v_assignee_role text;
 v_assignee_marketplace text;
 v_assignee_dept text;
 v_task public.workspace_tasks%rowtype;
 v_note public.workspace_task_notes%rowtype;
 v_remind timestamptz;
begin
 if v_uid is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 select a.system_role,a.category_marketplace into v_role,v_marketplace
 from public.app_user_access a where a.user_id=v_uid and a.is_blocked=false;
 if v_role is null then raise exception 'Рабочая роль не назначена' using errcode='42501'; end if;
 v_department := case when v_role='category_manager' and v_marketplace is not null
  then 'category_manager:'||v_marketplace else v_role end;

 if p_action='create' then
  v_title:=btrim(coalesce(p_payload->>'title',''));
  v_urgency:=p_payload->>'urgency';
  v_target:=p_payload->>'target_department';
  v_comment:=coalesce(p_payload->>'comment','');
  if char_length(v_title) not between 1 and 500 or v_urgency not in ('current','urgent','critical')
    or v_target is null or v_target not in (
    'analyst','procurement','ved','marketing','manager','commercial_director',
    'category_manager','category_manager:ozon','category_manager:wildberries','category_manager:yandex_market'
   ) or v_target=v_department or char_length(v_comment)>4000
  then raise exception 'Заполните задачу, срочность и отдел получателя' using errcode='22023'; end if;
  insert into public.workspace_tasks(title,urgency,created_by,created_department,target_department,comment)
   values (v_title,v_urgency,v_uid,v_department,v_target,v_comment) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
 end if;

 if p_action in ('note_add','note_update','note_delete') then
  if p_action='note_add' then
   v_title:=btrim(coalesce(p_payload->>'title',''));
   v_urgency:=coalesce(p_payload->>'urgency','current');
   v_status:=coalesce(p_payload->>'status','not_started');
   if char_length(v_title) not between 1 and 500 or v_urgency not in ('current','urgent','critical')
    or v_status not in ('not_started','in_progress','completed')
    then raise exception 'Некорректные данные заметки' using errcode='22023'; end if;
   v_remind:=nullif(p_payload->>'remind_at','')::timestamptz;
   insert into public.workspace_task_notes(owner_id,title,urgency,status,remind_at)
    values (v_uid,v_title,v_urgency,v_status,v_remind) returning id into v_id;
   return jsonb_build_object('ok',true,'id',v_id);
  end if;
  v_id:=(p_payload->>'id')::uuid;
  select * into v_note from public.workspace_task_notes where id=v_id and owner_id=v_uid for update;
  if not found then raise exception 'Заметка не найдена' using errcode='42501'; end if;
  if p_action='note_delete' then
   delete from public.workspace_task_notes where id=v_id;
  else
   v_title:=btrim(coalesce(p_payload->>'title',v_note.title));
   v_urgency:=coalesce(p_payload->>'urgency',v_note.urgency);
   v_status:=coalesce(p_payload->>'status',v_note.status);
   if char_length(v_title) not between 1 and 500 or v_urgency not in ('current','urgent','critical')
    or v_status not in ('not_started','in_progress','completed')
    then raise exception 'Некорректные данные заметки' using errcode='22023'; end if;
   v_remind:=case when p_payload ? 'remind_at'
     then nullif(p_payload->>'remind_at','')::timestamptz else v_note.remind_at end;
   update public.workspace_task_notes set title=v_title,urgency=v_urgency,
     status=v_status,remind_at=v_remind,updated_at=now() where id=v_id;
  end if;
  return jsonb_build_object('ok',true);
 end if;

 if p_action not in ('edit','comment','assignee','take','finish','status')
  then raise exception 'Неизвестное действие' using errcode='22023'; end if;
 v_id:=(p_payload->>'id')::uuid;
 select * into v_task from public.workspace_tasks where id=v_id for update;
 if not found then raise exception 'Задача не найдена' using errcode='42501'; end if;

 if p_action='edit' then
  if v_task.created_by<>v_uid or v_task.status<>'not_started'
    then raise exception 'Редактировать можно только свою ещё не начатую задачу' using errcode='42501'; end if;
  v_title:=btrim(coalesce(p_payload->>'title',v_task.title));
  v_urgency:=coalesce(p_payload->>'urgency',v_task.urgency);
  v_comment:=coalesce(p_payload->>'comment',v_task.comment);
  if char_length(v_title) not between 1 and 500 or v_urgency not in ('current','urgent','critical')
    or char_length(v_comment)>4000 then raise exception 'Некорректное содержимое задачи' using errcode='22023'; end if;
  update public.workspace_tasks set title=v_title,urgency=v_urgency,comment=v_comment,
   updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 if p_action='comment' then
  if v_task.created_by<>v_uid and v_task.target_department<>v_department
   then raise exception 'Нет доступа к комментарию' using errcode='42501'; end if;
  v_comment:=coalesce(p_payload->>'comment','');
  if char_length(v_comment)>4000 then raise exception 'Комментарий слишком длинный' using errcode='22023'; end if;
  update public.workspace_tasks set comment=v_comment,updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 if v_task.target_department<>v_department then
  raise exception 'Это задача другого отдела' using errcode='42501';
 end if;

 if p_action='assignee' then
  v_assignee:=nullif(p_payload->>'assignee_id','')::uuid;
  if v_assignee is not null then
   select a.system_role,a.category_marketplace into v_assignee_role,v_assignee_marketplace
    from public.app_user_access a where a.user_id=v_assignee and a.is_blocked=false;
   v_assignee_dept:=case when v_assignee_role='category_manager' and v_assignee_marketplace is not null
     then 'category_manager:'||v_assignee_marketplace else v_assignee_role end;
   if v_assignee_dept is distinct from v_department
    then raise exception 'Исполнитель должен принадлежать вашему отделу' using errcode='42501'; end if;
  end if;
  if v_task.status='completed' then raise exception 'Задача уже завершена' using errcode='22023'; end if;
  update public.workspace_tasks set assignee_id=v_assignee,updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 if p_action='take' or (p_action='status' and p_payload->>'status'='in_progress') then
  if v_task.status='not_started' and v_task.taken_by is null then
   update public.workspace_tasks set status='in_progress',taken_by=v_uid,
    assignee_id=v_uid,started_at=now(),finished_at=null,updated_at=now() where id=v_id;
  elsif v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid then
   raise exception 'Задача уже взята другим сотрудником или завершена' using errcode='42501';
  end if;
  return jsonb_build_object('ok',true);
 end if;

 if p_action='finish' or (p_action='status' and p_payload->>'status'='completed') then
  if v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid
    then raise exception 'Завершить может только взявший задачу сотрудник' using errcode='42501'; end if;
  update public.workspace_tasks set status='completed',finished_at=now(),updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 if p_action='status' and p_payload->>'status'='not_started' then
  if v_task.status='not_started' then return jsonb_build_object('ok',true); end if;
  if v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid
    then raise exception 'Сбросить работу может только взявший задачу сотрудник' using errcode='42501'; end if;
  update public.workspace_tasks set status='not_started',taken_by=null,started_at=null,
   finished_at=null,updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Неизвестный статус' using errcode='22023';
end;
$fn$;

revoke all on function public.workspace_tasks_snapshot() from public, anon;
revoke all on function public.workspace_task_action(text,jsonb) from public, anon;
grant execute on function public.workspace_tasks_snapshot() to authenticated;
grant execute on function public.workspace_task_action(text,jsonb) to authenticated;
