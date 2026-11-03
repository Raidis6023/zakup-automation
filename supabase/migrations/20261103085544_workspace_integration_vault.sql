create or replace function public.workspace_get_integration_secrets(p_names text[] default null::text[])
returns table(name text, secret_value text, updated_at timestamp with time zone)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    d.name,
    d.decrypted_secret,
    d.updated_at
  from vault.decrypted_secrets d
  where d.name = any(array[
    'ozon_seller_client_id',
    'ozon_seller_api_key',
    'ozon_performance_client_id',
    'ozon_performance_client_secret',
    'mpstats_token'
  ]::text[])
    and (p_names is null or d.name = any(p_names));
$function$;

create or replace function public.workspace_upsert_integration_secrets(p_secrets jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  item record;
  secret_id uuid;
begin
  if p_secrets is null or jsonb_typeof(p_secrets) <> 'object' then
    raise exception 'Secrets payload must be a JSON object';
  end if;

  for item in
    select key, value
    from jsonb_each_text(p_secrets)
  loop
    if item.key not in (
      'ozon_seller_client_id',
      'ozon_seller_api_key',
      'ozon_performance_client_id',
      'ozon_performance_client_secret',
      'mpstats_token'
    ) then
      raise exception 'Unsupported integration secret name';
    end if;

    if item.value is null or length(btrim(item.value)) = 0 then
      raise exception 'Integration secret cannot be empty';
    end if;

    select d.id into secret_id
    from vault.decrypted_secrets d
    where d.name = item.key
    limit 1;

    if secret_id is null then
      perform vault.create_secret(
        item.value,
        item.key,
        'Ключ интеграции WorkSpace: ' || item.key
      );
    else
      perform vault.update_secret(
        secret_id,
        item.value,
        item.key,
        'Ключ интеграции WorkSpace: ' || item.key
      );
    end if;

    secret_id := null;
  end loop;
end;
$function$;

revoke all on function public.workspace_get_integration_secrets(text[]) from public, anon, authenticated;
revoke all on function public.workspace_upsert_integration_secrets(jsonb) from public, anon, authenticated;
grant execute on function public.workspace_get_integration_secrets(text[]) to service_role;
grant execute on function public.workspace_upsert_integration_secrets(jsonb) to service_role;
