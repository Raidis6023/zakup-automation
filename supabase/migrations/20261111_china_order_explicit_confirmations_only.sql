-- A procurement buyer may confirm only part of the recommended demand.
-- The button is independent of pending decisions.
-- The VED draft can include ONLY strictly positive explicit manual approvals
-- for the selected transport scenario. Unreviewed and excluded SKUs are omitted.
-- No blank orders; preserve the existing freshness and transport checks.

DO $china_order_confirmed_only$
DECLARE
  v_wrapper text;
  v_original text;
  v_begin integer;
  v_end integer;
  v_prefix text;
  v_suffix text;
  v_marker text := '    from source_rows s';
  v_new_guard text := $guard$
  -- An explicit positive selection is enough; other SKUs need no decision.
  -- Never infer approval from the system-recommended quantities.
  IF NOT EXISTS (
    SELECT 1
    FROM public.china_calculation_items i
    JOIN public.products p ON p.id = i.product_id
    JOIN LATERAL (
      SELECT a.manual_quantity, a.adjusted_final_units
      FROM public.china_manual_adjustments a
      WHERE a.calculation_item_id = i.id
        AND a.scenario = p_scenario
      ORDER BY a.adjusted_at DESC, a.id DESC
      LIMIT 1
    ) chosen ON TRUE
    WHERE i.calculation_run_id = v_run_id
      AND i.needs_china_order = TRUE
      AND p.is_seasonal = FALSE
      AND chosen.manual_quantity > 0
      AND chosen.adjusted_final_units > 0
  ) THEN
    RAISE EXCEPTION
      'Не подтверждено ни одного товара для заказа. Отметьте нужные позиции кнопкой "В заказ".';
  END IF;

$guard$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_wrapper
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'create_ved_order_draft'
    AND pg_get_function_identity_arguments(oid) =
      'p_scenario text, p_preparation_department text, p_created_by_name text, p_created_by_user_id uuid, p_new_products_volume_m3 numeric';

  IF v_wrapper IS NULL THEN
    RAISE EXCEPTION 'Рабочая функция формирования заказа не найдена';
  END IF;

  v_begin := strpos(v_wrapper, '  -- Every demand item needs a buyer decision');
  v_end := strpos(v_wrapper,
    '  IF NOT EXISTS (' || chr(10) || '    SELECT 1 FROM public.china_calculation_runs r');

  IF v_begin > 0 AND v_end > v_begin THEN
    v_wrapper := left(v_wrapper, v_begin - 1) || v_new_guard || substr(v_wrapper, v_end);
    EXECUTE v_wrapper;
  ELSIF strpos(v_wrapper, 'An explicit positive selection is enough') = 0 THEN
    RAISE EXCEPTION 'Изменились условия создания черновика ВЭД';
  END IF;

  SELECT pg_get_functiondef(oid) INTO v_original
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'create_ved_order_draft_original_20261015'
    AND pg_get_function_identity_arguments(oid) =
      'p_scenario text, p_preparation_department text, p_created_by_name text, p_created_by_user_id uuid, p_new_products_volume_m3 numeric';

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Исходная функция создания черновика ВЭД не найдена';
  END IF;

  v_begin := strpos(v_original, v_marker);
  IF v_begin = 0 THEN
    RAISE EXCEPTION 'Изменился блок выбора строк черновика ВЭД';
  END IF;
  v_prefix := left(v_original, v_begin - 1);
  v_suffix := substr(v_original, v_begin);

  IF strpos(v_suffix, 's.container_manual_quantity > 0 AND s.container_effective_final_units >') = 0 THEN
    IF (length(v_suffix) - length(replace(v_suffix, 's.container_effective_final_units >', ''))) /
       length('s.container_effective_final_units >') <> 1
    THEN RAISE EXCEPTION 'Неоднозначный фильтр контейнерных товаров'; END IF;
    v_suffix := replace(v_suffix,
      's.container_effective_final_units >',
      's.container_manual_quantity > 0 AND s.container_effective_final_units >');
  END IF;

  IF strpos(v_suffix, 's.truck_manual_quantity > 0 AND s.truck_effective_final_units >') = 0 THEN
    IF (length(v_suffix) - length(replace(v_suffix, 's.truck_effective_final_units >', ''))) /
       length('s.truck_effective_final_units >') <> 1
    THEN RAISE EXCEPTION 'Неоднозначный фильтр товаров для фуры'; END IF;
    v_suffix := replace(v_suffix,
      's.truck_effective_final_units >',
      's.truck_manual_quantity > 0 AND s.truck_effective_final_units >');
  END IF;

  EXECUTE v_prefix || v_suffix;
END
$china_order_confirmed_only$;
