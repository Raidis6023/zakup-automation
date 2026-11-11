-- China procurement: plan 90 days of product availability AFTER transport arrival.
-- Container: 90 lead + 14 safety + 90 on arrival = 194 days.
-- Truck:     60 lead + 14 safety + 90 on arrival = 164 days.
-- Reorder when current coverage is below the applicable total horizon.
-- Round all positive requirements UP to full cartons; preserve old snapshots.
-- This file is safe to run after the corresponding live DB change.

DO $correct_procurement_horizon$
DECLARE
  v_source text;
  v_demand_old text;
  v_demand_new text;
  v_cartons_old text;
  v_cartons_new text;
  v_container_part text;
  v_truck_part text;
  v_a integer;
  v_b integer;
  v_c integer;
  v_note_old text := '60-day trigger, 104-day container, 74-day truck. VED preserved.';
  v_note_new text := '90-day on-arrival target, 194-day container horizon, 164-day truck horizon; 14-day buffer included in transport. VED preserved.';
  v_run_old text := '        14,' || chr(10) || '        104,' || chr(10)
                        || '        74,' || chr(10) || '        60,' || chr(10) || '        68,';
  v_run_new text := '        14,' || chr(10) || '        104,' || chr(10)
                        || '        74,' || chr(10) || '        90,' || chr(10) || '        68,';
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_source FROM pg_proc
  WHERE pronamespace='public'::regnamespace
    AND proname='run_china_calculation_v9_preview'
    AND pg_get_function_identity_arguments(oid)='';

  IF v_source IS NULL THEN RAISE EXCEPTION 'China v9 function missing'; END IF;
  IF strpos(v_source,v_note_new)>0 THEN RETURN; END IF;
  IF strpos(v_source,v_note_old)=0 OR strpos(v_source,v_run_old)=0 THEN
    RAISE EXCEPTION 'China v9 function changed, refuse to patch';
  END IF;

  v_a := strpos(v_source, '            CASE' || chr(10)
     || '                WHEN a.avg_sales_per_day <= 0' || chr(10)
     || '                THEN false');
  v_b := strpos(v_source,'            END AS truck_order_units');
  v_c := strpos(v_source,'    cartons AS (');
  IF v_a=0 OR v_b<=v_a OR v_c<=v_b THEN
    RAISE EXCEPTION 'China demand section cannot be identified';
  END IF;

  v_demand_old := substr(v_source, v_a, v_b-v_a+length('            END AS truck_order_units'));
  v_a := strpos(v_demand_old,'            END AS container_order_units');
  IF v_a=0 OR (length(v_demand_old)-length(replace(v_demand_old,'a.avg_sales_per_day * 60',''))) /
      length('a.avg_sales_per_day * 60')<>3 THEN
    RAISE EXCEPTION 'China demand gates not in expected old state';
  END IF;

  v_container_part := substr(v_demand_old,1,v_a-1);
  v_truck_part := substr(v_demand_old,v_a);
  v_container_part := replace(v_container_part,'a.avg_sales_per_day * 60','a.avg_sales_per_day * 194');
  v_container_part := replace(v_container_part,'a.avg_sales_per_day * 104','a.avg_sales_per_day * 194');
  v_truck_part := replace(v_truck_part,'a.avg_sales_per_day * 60','a.avg_sales_per_day * 164');
  v_truck_part := replace(v_truck_part,'a.avg_sales_per_day * 74','a.avg_sales_per_day * 164');
  v_demand_new := replace(v_container_part||v_truck_part,'round(','ceil(');

  v_b := strpos(v_source,'    final_calculation AS (');
  IF v_b<=v_c THEN RAISE EXCEPTION 'China carton section changed'; END IF;
  v_cartons_old := substr(v_source,v_c,v_b-v_c);
  v_cartons_new := replace(v_cartons_old,
    chr(10)||'                  OR d.container_order_units <'||chr(10)||'                      d.units_per_carton','');
  v_cartons_new := replace(v_cartons_new,
    chr(10)||'                  OR d.truck_order_units <'||chr(10)||'                      d.units_per_carton','');
  v_cartons_new := replace(v_cartons_new,'round(','ceil(');
  IF v_cartons_new=v_cartons_old OR strpos(v_cartons_new,'OR d.container_order_units <'||chr(10))>0
     OR strpos(v_cartons_new,'OR d.truck_order_units <'||chr(10))>0 THEN
    RAISE EXCEPTION 'China carton rounding did not change safely';
  END IF;

  v_source := replace(v_source,v_demand_old,v_demand_new);
  v_source := replace(v_source,v_cartons_old,v_cartons_new);
  v_source := replace(v_source,v_run_old,v_run_new);
  v_source := replace(v_source,v_note_old,v_note_new);
  EXECUTE v_source;
END
$correct_procurement_horizon$;

ALTER TABLE public.china_calculation_runs
  ALTER COLUMN order_batch_days SET DEFAULT 90;

DO $expose_arrival_target$
DECLARE
  v_code text;
  v_old text := $old_run$                'sales_window_days',
                    r.sales_window_days,$old_run$;
  v_new text := $new_run$                'sales_window_days',
                    r.sales_window_days,

                'order_batch_days',
                    r.order_batch_days,$new_run$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_code FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND proname='get_china_dashboard'
    AND pg_get_function_identity_arguments(oid)='';
  IF v_code IS NULL THEN RAISE EXCEPTION 'China dashboard function missing'; END IF;
  IF strpos(v_code,v_new)=0 THEN
    IF strpos(v_code,v_old)=0 THEN RAISE EXCEPTION 'Dashboard shape changed'; END IF;
    EXECUTE replace(v_code,v_old,v_new);
  END IF;
END
$expose_arrival_target$;
