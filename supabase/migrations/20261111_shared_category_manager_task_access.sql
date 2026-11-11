-- All marketplace category managers (Ozon, WB, Yandex Market) share the "Все КМ" queue.
-- Keep ordinary single-assignee semantics: one may take, only its taker may finish.
-- No other working department can take these tasks.
CREATE OR REPLACE FUNCTION public.workspace_task_action(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 v_task public.workspace_tasks%rowtype;
 v_note public.workspace_task_notes%rowtype;
 v_remind timestamptz;
 v_recipient uuid;
 v_actor_name text;
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
    'analyst','procurement','ved','marketing','manager',
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

 if p_action not in ('edit','comment','take','finish','cancel')
  then raise exception 'Неизвестное действие' using errcode='22023'; end if;
 v_id:=(p_payload->>'id')::uuid;
 select * into v_task from public.workspace_tasks where id=v_id for update;
 if not found then raise exception 'Задача не найдена' using errcode='42501'; end if;

 if v_task.cancelled_at is not null and p_action<>'cancel' then
  raise exception 'Задача отменена' using errcode='42501';
 end if;

 if p_action='cancel' then
  if v_task.created_by<>v_uid then
   raise exception 'Отменить задачу может только её постановщик' using errcode='42501';
  end if;
  if v_task.status='completed' then
   raise exception 'Выполненную задачу нельзя отменить' using errcode='22023';
  end if;
  if v_task.cancelled_at is not null then
   raise exception 'Задача уже отменена' using errcode='22023';
  end if;

  if v_task.status='in_progress' then
   v_recipient:=coalesce(v_task.taken_by,v_task.assignee_id);
   if v_recipient is not null and v_recipient<>v_uid then
    select btrim(concat_ws(' ',p.first_name,p.last_name))
      into v_actor_name
    from public.app_profiles p
    where p.id=v_uid;

    insert into public.workspace_task_notifications(
      task_id,recipient_id,actor_id,actor_name,task_title
    ) values (
      v_task.id,v_recipient,v_uid,
      coalesce(nullif(v_actor_name,''),'Сотрудник'),
      v_task.title
    );
   end if;
  end if;

  update public.workspace_tasks
  set cancelled_at=now(),cancelled_by=v_uid,updated_at=now()
  where id=v_id;

  return jsonb_build_object('ok',true);
 end if;

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
  and not (v_role='category_manager' and v_task.target_department='category_manager')
   then raise exception 'Нет доступа к комментарию' using errcode='42501'; end if;
  v_comment:=coalesce(p_payload->>'comment','');
  if char_length(v_comment)>4000 then raise exception 'Комментарий слишком длинный' using errcode='22023'; end if;
  update public.workspace_tasks set comment=v_comment,updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 if v_task.target_department<>v_department
  and not (v_role='category_manager' and v_task.target_department='category_manager') then
  raise exception 'Это задача другого отдела' using errcode='42501';
 end if;

 if p_action='take' then
  if v_task.status='not_started' and v_task.taken_by is null then
   update public.workspace_tasks set status='in_progress',taken_by=v_uid,
    assignee_id=v_uid,started_at=now(),finished_at=null,updated_at=now() where id=v_id;
  elsif v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid then
   raise exception 'Задача уже взята другим сотрудником или завершена' using errcode='42501';
  end if;
  return jsonb_build_object('ok',true);
 end if;

 if p_action='finish' then
  if v_task.status<>'in_progress' or v_task.taken_by is distinct from v_uid
    then raise exception 'Завершить может только взявший задачу сотрудник' using errcode='42501'; end if;
  update public.workspace_tasks set status='completed',finished_at=now(),updated_at=now() where id=v_id;
  return jsonb_build_object('ok',true);
 end if;

 raise exception 'Неизвестное действие' using errcode='22023';
end;
$function$;
