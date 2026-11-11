-- VED draft: allow zero confirmed goods. Never auto-include unreviewed products.
-- Orders with approved lines keep strict data freshness validation.
-- Empty drafts bypass only sales/stock freshness, not role, transport,
-- uniqueness, calculation presence or simulation checks.

DO $allow_empty_draft$
DECLARE
  v_wrapper text;
  v_original text;
  v_start integer;
  v_end integer;
  v_guard text := $guard$
  -- Confirmations are optional; no confirmation means an empty editable draft.
  SELECT EXISTS (
    SELECT 1
    FROM public.china_calculation_items i
    JOIN public.products p ON p.id=i.product_id
    JOIN LATERAL (
      SELECT a.manual_quantity,a.adjusted_final_units
      FROM public.china_manual_adjustments a
      WHERE a.calculation_item_id=i.id
        AND a.scenario=p_scenario
      ORDER BY a.adjusted_at DESC,a.id DESC
      LIMIT 1
    ) chosen ON TRUE
    WHERE i.calculation_run_id=v_run_id
      AND i.needs_china_order=TRUE
      AND p.is_seasonal=FALSE
      AND chosen.manual_quantity>0
      AND chosen.adjusted_final_units>0
  ) INTO v_has_selected_items;

$guard$;
  v_freshness text := '  IF NOT EXISTS ('||chr(10)||
    '    SELECT 1 FROM public.china_calculation_runs r';
BEGIN
  SELECT replace(pg_get_functiondef(oid),E'\r\n',E'\n')
  INTO v_wrapper FROM pg_proc
  WHERE pronamespace='public'::regnamespace
    AND proname='create_ved_order_draft'
    AND pg_get_function_identity_arguments(oid)=
    'p_scenario text, p_preparation_department text, p_created_by_name text, p_created_by_user_id uuid, p_new_products_volume_m3 numeric';

  IF v_wrapper IS NULL THEN RAISE EXCEPTION 'VED wrapper missing'; END IF;
  IF strpos(v_wrapper,'v_has_selected_items boolean')=0 THEN
    IF strpos(v_wrapper,'  v_response jsonb;'||chr(10)||'BEGIN')=0 THEN
      RAISE EXCEPTION 'VED wrapper declaration unexpected';
    END IF;
    v_wrapper:=replace(v_wrapper,'  v_response jsonb;'||chr(10)||'BEGIN',
      '  v_response jsonb;'||chr(10)||
      '  v_has_selected_items boolean := false;'||chr(10)||'BEGIN');
  END IF;

  v_start:=strpos(v_wrapper,'  -- An explicit positive selection is enough;');
  v_end:=strpos(v_wrapper,v_freshness);
  IF v_start>0 AND v_end>v_start THEN
    v_wrapper:=left(v_wrapper,v_start-1)||v_guard||substr(v_wrapper,v_end);
  ELSIF strpos(v_wrapper,'Confirmations are optional; no confirmation means an empty editable draft.')=0 THEN
    RAISE EXCEPTION 'VED original approval guard not found';
  END IF;

  IF strpos(v_wrapper,'  IF v_has_selected_items AND NOT EXISTS ('||chr(10)||
      '    SELECT 1 FROM public.china_calculation_runs r')=0 THEN
    IF strpos(v_wrapper,v_freshness)=0 THEN
      RAISE EXCEPTION 'VED freshness rule changed';
    END IF;
    v_wrapper:=replace(v_wrapper,v_freshness,
      '  IF v_has_selected_items AND NOT EXISTS ('||chr(10)||
      '    SELECT 1 FROM public.china_calculation_runs r');
  END IF;
  EXECUTE v_wrapper;

  SELECT replace(pg_get_functiondef(oid),E'\r\n',E'\n')
  INTO v_original FROM pg_proc
  WHERE pronamespace='public'::regnamespace
    AND proname='create_ved_order_draft_original_20261015'
    AND pg_get_function_identity_arguments(oid)=
    'p_scenario text, p_preparation_department text, p_created_by_name text, p_created_by_user_id uuid, p_new_products_volume_m3 numeric';

  IF v_original IS NULL THEN RAISE EXCEPTION 'VED original function missing'; END IF;
  v_start:=strpos(v_original,'    -- 9. ЗАПРЕЩАЕМ ПУСТОЙ ЗАКАЗ');
  v_end:=strpos(v_original,'    -- 10. СТАТИСТИКА ЧЕРНОВИКА');
  IF v_start>0 AND v_end>v_start THEN
    v_original:=left(v_original,v_start-1)||
      '    -- 9. ПУСТОЙ ЧЕРНОВИК РАЗРЕШЁН. НЕПОДТВЕРЖДЁННЫЕ ТОВАРЫ НЕ ДОБАВЛЯЮТСЯ.'||
      chr(10)||chr(10)||substr(v_original,v_end);
  ELSIF strpos(v_original,'ПУСТОЙ ЧЕРНОВИК РАЗРЕШЁН')=0 THEN
    RAISE EXCEPTION 'VED original empty order guard changed';
  END IF;
  v_original:=replace(v_original,'''effective_final_units_gt_zero''',
    '''explicit_positive_manual_quantity_only_or_empty''');
  EXECUTE v_original;
END
$allow_empty_draft$;