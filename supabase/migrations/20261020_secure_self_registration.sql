create table if not exists public.app_registration_sessions (
  request_id uuid primary key references public.app_access_requests(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.app_registration_sessions enable row level security;
revoke all on public.app_registration_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.app_registration_sessions to service_role;

create or replace function public.app_finalize_self_registration(
  p_request_id uuid, p_created_user_id uuid, p_token_hash text
) returns boolean language plpgsql security definer set search_path to ''
as $$
declare
  v_session public.app_registration_sessions%rowtype;
  v_request public.app_access_requests%rowtype;
begin
  select * into v_session from public.app_registration_sessions
  where request_id = p_request_id for update;
  if not found or v_session.token_hash <> p_token_hash
    or v_session.expires_at <= now() or v_session.consumed_at is not null then
    raise exception 'Сессия регистрации недействительна';
  end if;
  select * into v_request from public.app_access_requests
  where id = p_request_id for update;
  if not found or v_request.status <> 'approved'
    or v_request.approved_user_id is not null
    or v_request.assigned_system_role not in
    ('analyst','procurement','ved','category_manager','marketing','manager') then
    raise exception 'Заявка не готова к завершению регистрации';
  end if;
  update public.app_profiles set first_name = v_request.first_name,
    last_name = v_request.last_name, email = lower(trim(v_request.email))
  where id = p_created_user_id;
  if not found then raise exception 'Профиль не найден'; end if;
  update public.app_user_access set system_role = v_request.assigned_system_role,
    category_marketplace = v_request.assigned_category_marketplace,
    admin_level = 'none', must_change_password = false
  where user_id = p_created_user_id;
  if not found then raise exception 'Доступ не найден'; end if;
  update public.app_access_requests set approved_user_id = p_created_user_id where id = p_request_id;
  update public.app_registration_sessions set consumed_at = now() where request_id = p_request_id;
  return true;
end;
$$;
revoke all on function public.app_finalize_self_registration(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.app_finalize_self_registration(uuid, uuid, text) to service_role;

-- Avoid parallel pending/approved-but-unregistered requests for the same email.
CREATE UNIQUE INDEX IF NOT EXISTS app_registration_one_unfinished_email
  ON public.app_access_requests (lower(email))
  WHERE status = 'pending' OR (status = 'approved' AND approved_user_id IS NULL);
