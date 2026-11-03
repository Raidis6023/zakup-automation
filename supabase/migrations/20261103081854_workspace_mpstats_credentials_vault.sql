create or replace function public.workspace_get_mpstats_credentials()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select d.decrypted_secret::jsonb
  from vault.decrypted_secrets as d
  where d.name = 'workspace_mpstats_credentials'
  order by d.created_at desc
  limit 1
$function$;

create or replace function public.workspace_save_mpstats_credentials(p_api_key text)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_id uuid;
  v_payload jsonb;
begin
  if nullif(btrim(p_api_key), '') is null then
    raise exception 'Не указан API-ключ MPStats';
  end if;

  if length(btrim(p_api_key)) < 20 or length(btrim(p_api_key)) > 512 then
    raise exception 'Некорректная длина API-ключа MPStats';
  end if;

  v_payload := jsonb_build_object(
    'apiKey', btrim(p_api_key),
    'updatedAt', clock_timestamp()
  );

  select s.id
    into v_id
    from vault.secrets as s
   where s.name = 'workspace_mpstats_credentials'
   limit 1;

  if v_id is null then
    v_id := vault.create_secret(
      v_payload::text,
      'workspace_mpstats_credentials',
      'MPStats analytics API token for Wildberries unit economics'
    );
  else
    perform vault.update_secret(
      v_id,
      v_payload::text,
      'workspace_mpstats_credentials',
      'MPStats analytics API token for Wildberries unit economics'
    );
  end if;

  return v_id;
end;
$function$;

create or replace function public.workspace_delete_mpstats_credentials()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  delete from vault.secrets
   where name = 'workspace_mpstats_credentials';
end;
$function$;

revoke all on function public.workspace_get_mpstats_credentials() from public, anon, authenticated;
revoke all on function public.workspace_save_mpstats_credentials(text) from public, anon, authenticated;
revoke all on function public.workspace_delete_mpstats_credentials() from public, anon, authenticated;
grant execute on function public.workspace_get_mpstats_credentials() to service_role;
grant execute on function public.workspace_save_mpstats_credentials(text) to service_role;
grant execute on function public.workspace_delete_mpstats_credentials() to service_role;
