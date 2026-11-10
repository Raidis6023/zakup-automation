-- Закуп P0: подтверждённая загрузка WB, отсечение устаревших данных и защита RPC.
-- Не изменяет пороги 60/70/100 дней и не удаляет существующие заказы.
create table if not exists public.wb_sales_import_runs (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  status text not null check (status in ('running','success','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_received integer,
  rows_saved integer,
  fbw_sales integer,
  fbw_returns integer,
  error text,
  constraint wb_sales_import_window_valid check (date_to >= date_from)
);
create index if not exists idx_wb_sales_import_success
  on public.wb_sales_import_runs (completed_at desc, date_from, date_to)
  where status = 'success';
alter table public.wb_sales_import_runs enable row level security;
revoke all on table public.wb_sales_import_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.wb_sales_import_runs to service_role;

-- Recompilation keeps the existing tested v9 business formula intact.
do $procurement_guard$
declare
  definition text;
  original_anchor text := '    -- 7. Проверка master_code закупочных товаров.';
  guard text := $guard$
    -- Fail closed: 28-day WB purchases/returns must come from a verified complete import.
    IF v_date_to < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
       OR NOT EXISTS (
           SELECT 1 FROM public.wb_sales_import_runs w
           WHERE w.status = 'success'
             AND w.date_from <= v_date_from
             AND w.date_to >= v_date_to
             AND w.completed_at >= now() - interval '36 hours'
       )
    THEN
        RAISE EXCEPTION
          'Закуп заблокирован: нет подтверждённой полной выгрузки продаж WB за 28 дней. Обновите продажи WB.';
    END IF;

    -- Missing/old stock snapshots cannot silently turn into zero stock.
    IF v_own_date IS NULL
       OR v_responsible_date IS NULL
       OR v_ozon_date IS NULL
       OR v_wb_snapshot_at IS NULL
       OR v_yandex_date IS NULL
       OR v_own_date < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 3
       OR v_responsible_date < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 3
       OR v_ozon_date < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
       OR v_yandex_date < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
       OR v_wb_snapshot_at < now() - interval '72 hours'
    THEN
        RAISE EXCEPTION
          'Закуп заблокирован: остатки собственного склада, ОХ или маркетплейсов устарели. Обновите снимки остатков.';
    END IF;

$guard$;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='run_china_calculation_v9_preview'
  limit 1;
  if definition is null then raise exception 'Расчёт v9 не найден'; end if;
  if position('idx_wb_sales_import_success' in definition) > 0 then
    raise exception 'Некорректное совпадение защитного маркера';
  end if;
  if position('public.wb_sales_import_runs w' in definition) = 0 then
    if position(original_anchor in definition) = 0 then
      raise exception 'Изменена структура расчёта v9, безопасная вставка невозможна';
    end if;
    execute replace(definition, original_anchor, guard || original_anchor);
  end if;
end;
$procurement_guard$;

-- An older run must not be converted into a real VED order.
do $draft_guard$
declare
  definition text;
  original_anchor text := '  -- The latest simulation must belong to exactly the same calculation.';
  guard text := $guard$
  IF NOT EXISTS (
    SELECT 1 FROM public.china_calculation_runs r
    WHERE r.id = v_run_id
      AND r.calculation_version = 'v9'
      AND r.calculated_at >= now() - interval '36 hours'
      AND r.sales_date_to >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
      AND r.own_stock_snapshot_date >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 3
      AND r.responsible_storage_snapshot_date >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 3
      AND r.ozon_stock_snapshot_date >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
      AND r.yandex_stock_snapshot_date >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 2
      AND r.wb_stock_snapshot_at >= now() - interval '72 hours'
      AND EXISTS (
        SELECT 1 FROM public.wb_sales_import_runs w
        WHERE w.status = 'success'
          AND w.date_from <= r.sales_date_from
          AND w.date_to >= r.sales_date_to
          AND w.completed_at <= r.calculated_at
          AND w.completed_at >= r.calculated_at - interval '36 hours'
      )
  ) THEN
    RAISE EXCEPTION
      'Нельзя создать заказ: последний расчёт не подтверждён свежими продажами WB и остатками. Обновите данные и пересчитайте закуп.';
  END IF;

$guard$;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='create_ved_order_draft'
  limit 1;
  if definition is null then raise exception 'Создание заказа ВЭД не найдено'; end if;
  if position('public.wb_sales_import_runs w' in definition) = 0 then
    if position(original_anchor in definition) = 0 then
      raise exception 'Изменена защита создания заказа, безопасная вставка невозможна';
    end if;
    execute replace(definition, original_anchor, guard || original_anchor);
  end if;
end;
$draft_guard$;

-- Service-role calls are made by authenticated and role-checked server actions.
-- Anonymous and generic authenticated users must not call privileged RPC directly.
revoke execute on function public.run_china_calculation() from public, anon, authenticated;
revoke execute on function public.simulate_china_transport(numeric,uuid) from public, anon, authenticated;
grant execute on function public.run_china_calculation() to service_role;
grant execute on function public.simulate_china_transport(numeric,uuid) to service_role;
