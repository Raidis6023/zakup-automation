-- Every item with procurement demand must be explicitly reviewed by a buyer
-- before creating a new VED draft. Manual quantity >0 includes, 0 excludes.
-- Existing VED orders, physical stock, and 60/70/100-day formulas are unchanged.
DO $review_guard$
DECLARE
  v_definition text;
  v_start integer;
  v_end integer;
  v_start_anchor text := '  -- A rounded-to-zero purchase must be explicitly accepted or adjusted by a buyer.';
  v_end_anchor text := E'  IF NOT EXISTS (\n    SELECT 1 FROM public.china_calculation_runs r';
  v_guard text := $guard$
  -- Every demand item needs a buyer decision for the CURRENT transport scenario.
  -- The original VED draft implementation consumes latest manual quantities.
  IF EXISTS (
    SELECT 1
    FROM public.china_calculation_items i
    WHERE i.calculation_run_id = v_run_id
      AND i.needs_china_order = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.china_manual_adjustments a
        WHERE a.calculation_item_id = i.id
          AND a.scenario = p_scenario
      )
  ) THEN
    RAISE EXCEPTION
      'Есть товары без решения о включении в заказ. Откройте таблицу "Потребность в закупке" и подтвердите или исключите каждую позицию.';
  END IF;

$guard$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')
    INTO v_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='create_ved_order_draft';
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'VED order creation RPC is missing';
  END IF;
  IF position('Every demand item needs a buyer decision' IN v_definition)>0 THEN
    RETURN;
  END IF;
  v_start:=position(v_start_anchor IN v_definition);
  v_end:=position(v_end_anchor IN v_definition);
  IF v_start=0 OR v_end=0 OR v_end<=v_start THEN
    RAISE EXCEPTION 'VED order creation guard differs from audited source';
  END IF;
  EXECUTE substr(v_definition,1,v_start-1) || v_guard || substr(v_definition,v_end);
END;
$review_guard$;
