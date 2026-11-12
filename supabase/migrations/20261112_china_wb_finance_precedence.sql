
-- Prefer completed finance on days it has settled FBW transactions.
-- Operational WB sales fill only the finance-lag days. The Order Feed
-- remains highest priority for any previously verified dates.
DO $fix_priority$
DECLARE v text; fin text; fixed text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO v
 FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname='run_china_calculation_v9_preview'
 AND pg_get_function_identity_arguments(oid)='';
 IF v IS NULL THEN RAISE EXCEPTION 'China v9 missing'; END IF;
 IF strpos(v,'wb_operational_verified AS (')=0 THEN
  RAISE EXCEPTION 'Operational source is not installed'; END IF;

 fin:=split_part(split_part(v,'wb_finance_fallback AS (',2),'wb_feed_verified AS (',1);
 IF strpos(fin,'          AND NOT EXISTS ('||chr(10)||
 '            SELECT 1 FROM public.china_wb_operational_days d')>0 THEN
  fixed:=replace(fin,
   '          AND NOT EXISTS ('||chr(10)||
   '            SELECT 1 FROM public.china_wb_operational_days d'||
   ' WHERE d.sale_day=((l.payload->>''saleDt'')::timestamptz'||
   ' AT TIME ZONE ''Europe/Moscow'')::date'||
   '          )'||chr(10),'');
  IF fixed=fin THEN RAISE EXCEPTION 'Finance precedence override shape changed'; END IF;
  v:=replace(v,fin,fixed);
 END IF;

 IF strpos(v,'AND NOT (s.sale_day=ANY(v_wb_finance_days))')=0 THEN
  IF strpos(v,'WHERE f.sale_day=s.sale_day)')=0 THEN
   RAISE EXCEPTION 'Operational source day gate changed'; END IF;
  v:=replace(v,'WHERE f.sale_day=s.sale_day)',
    'WHERE f.sale_day=s.sale_day)'||chr(10)||
    '        AND NOT (s.sale_day=ANY(v_wb_finance_days))');
 END IF;
 EXECUTE v;
END
$fix_priority$;
