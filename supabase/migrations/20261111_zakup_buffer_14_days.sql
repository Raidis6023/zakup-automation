-- Keep the 28-day sales window and 60-day purchase trigger unchanged.
-- Container: 90-day lead + 14-day buffer = 104 days.
-- Truck: 60-day lead + 14-day buffer = 74 days.
-- This migration is idempotent and preserves historical calculation snapshots.

DO $update_china_buffer$
DECLARE
  v_definition text;
  v_old text := '        10,' || chr(10) || '        100,' || chr(10) || '        70,';
  v_new text := '        14,' || chr(10) || '        104,' || chr(10) || '        74,';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'run_china_calculation_v9_preview'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Не найдена рабочая функция расчёта Китая v9';
  END IF;

  IF strpos(v_definition, v_old) > 0 THEN
    IF strpos(v_definition, 'a.avg_sales_per_day * 100') = 0
       OR strpos(v_definition, 'a.avg_sales_per_day * 70') = 0
       OR strpos(v_definition, '60-day trigger, 100-day container, 70-day truck.') = 0
    THEN
      RAISE EXCEPTION 'Формулы расчёта Китая изменились: автоматическая замена остановлена';
    END IF;

    v_definition := replace(v_definition, v_old, v_new);
    v_definition := replace(v_definition, 'a.avg_sales_per_day * 100', 'a.avg_sales_per_day * 104');
    v_definition := replace(v_definition, 'a.avg_sales_per_day * 70', 'a.avg_sales_per_day * 74');
    v_definition := replace(v_definition, '60-day trigger, 100-day container, 70-day truck.', '60-day trigger, 104-day container, 74-day truck.');
    EXECUTE v_definition;
  ELSIF strpos(v_definition, v_new) = 0
     OR strpos(v_definition, 'a.avg_sales_per_day * 104') = 0
     OR strpos(v_definition, 'a.avg_sales_per_day * 74') = 0
  THEN
    RAISE EXCEPTION 'Неожиданный формат функции: настройка буфера не применена';
  END IF;
END
$update_china_buffer$;

ALTER TABLE public.china_calculation_runs
  ALTER COLUMN safety_buffer_days SET DEFAULT 14,
  ALTER COLUMN container_order_point_days SET DEFAULT 104,
  ALTER COLUMN truck_order_point_days SET DEFAULT 74;
