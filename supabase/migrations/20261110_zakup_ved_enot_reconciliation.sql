-- Procurement / VED reconciliation, 2026-11-10.
-- Include linked imported external VED orders in committed quantities by ENOT,
-- without modifying physical stock, VED order rows, or the 60/70/100-day rules.
DO $ved_reconciliation$
DECLARE
  v_definition text;
  v_old text := $old$
    -- ВЭД: исходную логику v8 сохраняем.
    active_ved AS (
        SELECT
            pm.master_code,
            sum(i.quantity)::integer AS quantity
        FROM public.ved_order_items i
        JOIN public.ved_orders o
          ON o.id = i.ved_order_id
        JOIN product_master pm
          ON pm.product_id = i.product_id
        WHERE i.quantity > 0
          AND (
              o.workflow_status IN (
                  'production_confirmed',
                  'in_transit'
              )
              OR (
                  o.workflow_status = 'arrived'
                  AND o.arrival_confirmed_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.own_stock_snapshots after_arrival
                      WHERE after_arrival.imported_at >
                            o.arrival_confirmed_at
                        AND after_arrival.snapshot_date >=
                            coalesce(
                                o.actual_arrival_date,
                                o.arrival_confirmed_at::date
                            )
                  )
              )
          )
        GROUP BY pm.master_code
    ),

$old$;
  v_new text := $new$
    -- ВЭД: заказанные количества отделены от физического склада.
    -- Импортированные внешние проформы с подтверждённым совпадением ЕНОТ
    -- резервируют потребность уже на этапе "В работе". Неопознанные позиции,
    -- черновики, отменённые и тестовые заказы не резервируют закуп.
    active_ved AS (
        SELECT
            pm.master_code,
            sum(
                CASE
                    WHEN o.workflow_status = 'ved_in_work'
                    THEN i.order_quantity
                    WHEN o.workflow_status = 'arrived'
                    THEN i.quantity
                    ELSE coalesce(nullif(i.order_quantity, 0), i.quantity)
                END
            )::integer AS quantity
        FROM public.ved_order_items i
        JOIN public.ved_orders o
          ON o.id = i.ved_order_id
        JOIN product_master pm
          ON pm.product_id = i.product_id
        WHERE i.status NOT IN ('rejected', 'cancelled')
          AND (
              (
                  o.workflow_status = 'ved_in_work'
                  AND o.created_by_name = 'Импорт внешних заказов'
                  AND i.order_quantity > 0
              )
              OR (
                  o.workflow_status IN ('production_confirmed', 'in_transit')
                  AND coalesce(nullif(i.order_quantity, 0), i.quantity) > 0
              )
              OR (
                  o.workflow_status = 'arrived'
                  AND i.quantity > 0
                  AND o.arrival_confirmed_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.own_stock_snapshots after_arrival
                      WHERE after_arrival.imported_at > o.arrival_confirmed_at
                        AND after_arrival.snapshot_date >= coalesce(
                            o.actual_arrival_date,
                            o.arrival_confirmed_at::date
                        )
                  )
              )
          )
        GROUP BY pm.master_code
    ),

$new$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='run_china_calculation_v9_preview'
  LIMIT 1;

  IF v_definition IS NULL OR position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'Current VED procurement block differs from audited v9; refusing to patch';
  END IF;
  IF (length(v_definition)-length(replace(v_definition,v_old,'')))<>length(v_old) THEN
    RAISE EXCEPTION 'Expected exactly one VED procurement block';
  END IF;
  EXECUTE replace(v_definition,v_old,v_new);
END;
$ved_reconciliation$;
