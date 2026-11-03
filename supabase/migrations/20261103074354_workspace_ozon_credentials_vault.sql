create extension if not exists supabase_vault with schema vault;

create or replace function public.workspace_get_ozon_credentials()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select d.decrypted_secret::jsonb
  from vault.decrypted_secrets as d
  where d.name = 'workspace_ozon_credentials'
  order by d.created_at desc
  limit 1
$function$;

create or replace function public.workspace_save_ozon_credentials(p_credentials jsonb)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_id uuid;
  v_payload jsonb;
begin
  if p_credentials is null or jsonb_typeof(p_credentials) <> 'object' then
    raise exception 'Некорректный формат настроек Ozon';
  end if;

  if nullif(btrim(p_credentials->>'sellerClientId'), '') is null
     or nullif(btrim(p_credentials->>'sellerApiKey'), '') is null
     or nullif(btrim(p_credentials->>'performanceClientId'), '') is null
     or nullif(btrim(p_credentials->>'performanceClientSecret'), '') is null then
    raise exception 'Не заполнены обязательные ключи Ozon';
  end if;

  v_payload := jsonb_build_object(
    'sellerClientId', btrim(p_credentials->>'sellerClientId'),
    'sellerApiKey', btrim(p_credentials->>'sellerApiKey'),
    'performanceClientId', btrim(p_credentials->>'performanceClientId'),
    'performanceClientSecret', btrim(p_credentials->>'performanceClientSecret'),
    'storeName', nullif(btrim(p_credentials->>'storeName'), ''),
    'sellerId', nullif(btrim(p_credentials->>'sellerId'), ''),
    'verifiedAt', nullif(btrim(p_credentials->>'verifiedAt'), ''),
    'updatedAt', clock_timestamp()
  );

  select s.id into v_id
  from vault.secrets as s
  where s.name = 'workspace_ozon_credentials'
  limit 1;

  if v_id is null then
    v_id := vault.create_secret(
      v_payload::text,
      'workspace_ozon_credentials',
      'Ozon Seller and Performance credentials'
    );
  else
    perform vault.update_secret(
      v_id,
      v_payload::text,
      'workspace_ozon_credentials',
      'Ozon Seller and Performance credentials'
    );
  end if;

  return v_id;
end;
$function$;

revoke all on function public.workspace_get_ozon_credentials() from public, anon, authenticated;
revoke all on function public.workspace_save_ozon_credentials(jsonb) from public, anon, authenticated;
grant execute on function public.workspace_get_ozon_credentials() to service_role;
grant execute on function public.workspace_save_ozon_credentials(jsonb) to service_role;
