-- Prevent a 2-day sales cutoff from blocking China procurement when WB's
-- complete daily financial report has a verified 3-4 day posting delay.
-- The *actual* 28-day window must be verified for Ozon, WB and Yandex.
-- Never turn a missing or partial WB day into zero sales.
DO $zakup_window$
DECLARE
  f text;
  old_part text;
  new_part text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid),E'\r\n',E'\n') INTO f
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='run_china_calculation_v9_preview';

  old_part := 'AND r.date_to >= (now() AT TIME ZONE ''Asia/Krasnoyarsk'')::date - 2';
  new_part := 'AND r.date_to >= (now() AT TIME ZONE ''Asia/Krasnoyarsk'')::date - 4';
  IF f IS NULL OR position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown v9 period selector; stopped';
  END IF;
  f:=replace(f,old_part,new_part);

  old_part := 'IF v_date_to < (now() AT TIME ZONE ''Asia/Krasnoyarsk'')::date - 2';
  new_part := 'IF v_date_to < (now() AT TIME ZONE ''Asia/Krasnoyarsk'')::date - 4';
  IF position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown v9 WB freshness check; stopped';
  END IF;
  f:=replace(f,old_part,new_part);

  old_part := 'AND y.finished_at>=now()-interval ''72 hours''';
  IF position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown v9 Yandex success selector; stopped';
  END IF;
  -- A confirmed complete 28-day Yandex run is still valid for the selected
  -- 4-day fresh window even when its finishing timestamp is >72h old.
  f:=replace(f,old_part,'');

  old_part := '''Нет успешного периода Ozon за 28 дней''';
  IF position(old_part IN f)>0 THEN
    f:=replace(f,old_part,
      '''Нет общего полного 28-дневного периода Ozon, WB и Яндекс Маркета. Проверьте ежедневную выгрузку WB.''');
  END IF;
  EXECUTE f;

  SELECT replace(pg_get_functiondef(p.oid),E'\r\n',E'\n') INTO f
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='china_import_wb_sales_from_daily';

  old_part := 'and o.date_to >= (now() at time zone ''Asia/Krasnoyarsk'')::date - 2';
  new_part := 'and o.date_to >= (now() at time zone ''Asia/Krasnoyarsk'')::date - 4';
  IF f IS NULL OR position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown WB daily importer period selector; stopped';
  END IF;
  f:=replace(f,old_part,new_part);

  old_part := 'and y.finished_at >= now() - interval ''72 hours''';
  IF position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown WB importer Yandex period selector; stopped';
  END IF;
  f:=replace(f,old_part,'');
  EXECUTE f;

  SELECT replace(pg_get_functiondef(p.oid),E'\r\n',E'\n') INTO f
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='run_china_calculation_with_transport';

  old_part := 'v_run_id := public.run_china_calculation();';
  new_part := 'PERFORM public.china_import_wb_sales_from_daily();' || E'\n  ' ||
              'v_run_id := public.run_china_calculation();';
  IF f IS NULL OR position(old_part IN f)=0 THEN
    RAISE EXCEPTION 'Unknown unified China calculation procedure; stopped';
  END IF;
  -- Daily sales cache is checked and refreshed inside the SAME transaction.
  -- Failure rolls the import, calculation and transport back together.
  f:=replace(f,old_part,new_part);
  EXECUTE f;
END
$zakup_window$;
