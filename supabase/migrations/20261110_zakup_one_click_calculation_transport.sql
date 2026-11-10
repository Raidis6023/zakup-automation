-- A single atomic operation for China procurement and its transport volume.
-- No manual volume for new SKUs: only products present in the calculated dataset.
CREATE OR REPLACE FUNCTION public.run_china_calculation_with_transport()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_run_id uuid;
  v_simulation_id uuid;
BEGIN
  -- Prevent two simultaneous clicks creating competing "latest" calculations.
  PERFORM pg_advisory_xact_lock(hashtext('china_run_and_simulate'));

  v_run_id := public.run_china_calculation();

  -- Passing the ID protects against a concurrent calculation for a different run.
  -- Keeping both calls in one transaction avoids an incomplete recalculation.
  v_simulation_id := public.simulate_china_transport(0::numeric, v_run_id);

  IF v_run_id IS NULL OR v_simulation_id IS NULL THEN
    RAISE EXCEPTION 'Не удалось завершить расчёт потребности и кубатуры';
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'calculation_run_id',v_run_id,
    'transport_simulation_id',v_simulation_id,
    'new_products_volume_m3',0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_china_calculation_with_transport()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_china_calculation_with_transport()
  TO service_role;
