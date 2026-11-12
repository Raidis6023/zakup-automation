
-- Separate operational FBW sales (preliminary) from WB financial sales (final).
-- Never copy source data into wb_sales or overwrite the WB finance history.
CREATE TABLE IF NOT EXISTS public.china_wb_operational_sales (
 sale_id text PRIMARY KEY CHECK (left(sale_id,1) IN ('S','R')),
 nm_id bigint NOT NULL CHECK (nm_id>0),
 srid text,
 sale_day date NOT NULL,
 last_change_at timestamptz NOT NULL,
 is_return boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS china_wb_operational_sales_day_nm
 ON public.china_wb_operational_sales(sale_day,nm_id);
CREATE TABLE IF NOT EXISTS public.china_wb_operational_days (
 sale_day date PRIMARY KEY,
 job_day date NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.china_wb_operational_jobs (
 job_day date PRIMARY KEY,
 date_from date NOT NULL,
 date_to date NOT NULL,
 status text NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','running','waiting','rate_limited','complete','failed')),
 cursor text,
 rows_seen integer NOT NULL DEFAULT 0,
 fbw_rows integer NOT NULL DEFAULT 0,
 last_error text,
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.china_wb_operational_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.china_wb_operational_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.china_wb_operational_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.china_wb_operational_sales FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.china_wb_operational_days FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.china_wb_operational_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.china_wb_operational_sales TO service_role;
GRANT ALL ON public.china_wb_operational_days TO service_role;
GRANT ALL ON public.china_wb_operational_jobs TO service_role;
INSERT INTO public.wb_sync_state(sync_key,updated_at)
 VALUES ('china_supplier_sales',now()) ON CONFLICT (sync_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.china_finish_wb_operational_import(
 p_job_day date, p_date_from date, p_date_to date
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $finish$
DECLARE v_days integer;
BEGIN
 IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from
    OR p_date_to > (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 1
    OR p_date_to-p_date_from > 50 THEN
    RAISE EXCEPTION 'Invalid supplier-sales coverage period';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.china_wb_operational_jobs
   WHERE job_day=p_job_day AND date_from=p_date_from AND date_to=p_date_to
   AND status IN ('running','waiting')
 ) THEN RAISE EXCEPTION 'Missing active operational WB job'; END IF;
 INSERT INTO public.china_wb_operational_days(sale_day,job_day,verified_at)
 SELECT g::date,p_job_day,now()
 FROM generate_series(p_date_from::timestamp,p_date_to::timestamp,interval '1 day') g
 ON CONFLICT (sale_day) DO UPDATE SET
  job_day=excluded.job_day, verified_at=excluded.verified_at;
 GET DIAGNOSTICS v_days=ROW_COUNT;
 UPDATE public.china_wb_operational_jobs SET status='complete',cursor=NULL,
  completed_at=now(),last_error=NULL,updated_at=now()
 WHERE job_day=p_job_day;
 RETURN v_days;
END
$finish$;
REVOKE ALL ON FUNCTION public.china_finish_wb_operational_import(date,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.china_finish_wb_operational_import(date,date,date) TO service_role;

-- Patch only the WB source selection in v9; leave stock, procurement horizon,
-- manual order approval and transport functions untouched.
DO $patch$
DECLARE
 src text;
 original_fin text;
 changed_fin text;
 old_preflight text;
 new_preflight text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO src FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='run_china_calculation_v9_preview'
   AND pg_get_function_identity_arguments(oid)='';
 IF src IS NULL THEN RAISE EXCEPTION 'Missing China v9 calculation'; END IF;
 IF strpos(src,'wb_operational_verified AS (')>0 THEN RETURN; END IF;
 IF strpos(src,'a.avg_sales_per_day * 194')=0
   OR strpos(src,'a.avg_sales_per_day * 164')=0 THEN
   RAISE EXCEPTION 'Unexpected procurement horizon. Refuse to overwrite calculation';
 END IF;

 -- A day is eligible if fully obtained by the order feed OR
 -- completed supplier-sales fetch OR completed finance report.
 IF strpos(src,'OR g.day_value::date = ANY(v_wb_finance_days)')=0 THEN
   RAISE EXCEPTION 'WB source window gate moved';
 END IF;
 src:=replace(src,'OR g.day_value::date = ANY(v_wb_finance_days)',
   'OR g.day_value::date = ANY(v_wb_finance_days)'||chr(10)||
   '          OR EXISTS (SELECT 1 FROM public.china_wb_operational_days op'||
   ' WHERE op.sale_day=g.day_value::date)');

 -- The presence of FBW transactions can be established by any of the three
 -- covered and validated sources; a completely empty daily snapshot is valid.
 old_preflight:='    ) THEN'||chr(10)||
       '       RAISE EXCEPTION ''Нет подтверждённых продаж FBW ни в Ленте заказов, ни в резервном источнике'';';
 IF strpos(src,old_preflight)=0 THEN RAISE EXCEPTION 'WB preflight changed'; END IF;
 new_preflight:='    ) AND NOT EXISTS ('||chr(10)||
       '        SELECT 1 FROM public.china_wb_operational_sales s'||
       ' JOIN public.china_wb_operational_days d ON d.sale_day=s.sale_day'||
       ' WHERE s.sale_day BETWEEN v_date_from AND v_date_to'||
       '    ) THEN'||chr(10)||
       '       RAISE EXCEPTION ''Нет подтверждённых продаж FBW ни в одном источнике'';';
 src:=replace(src,old_preflight,new_preflight);

 -- Finance is exclusive of the operational completed days (and feed days).
 original_fin := split_part(split_part(src,'wb_finance_fallback AS (',2),'wb_feed_verified AS (',1);
 IF strpos(original_fin,'AND NOT EXISTS (')=0 OR
    strpos(original_fin,'-- Cross-date de-duplication')=0 THEN
    RAISE EXCEPTION 'Finance WB selection changed';
 END IF;
 changed_fin := replace(original_fin,
   '          -- Cross-date de-duplication:',
   '          AND NOT EXISTS ('||chr(10)||
   '            SELECT 1 FROM public.china_wb_operational_days d'||
   ' WHERE d.sale_day=((l.payload->>''saleDt'')::timestamptz'||
   ' AT TIME ZONE ''Europe/Moscow'')::date'||
   '          )'||chr(10)||
   '          -- Cross-date de-duplication:');
 IF changed_fin=original_fin THEN RAISE EXCEPTION 'Operational finance exclusion failed'; END IF;
 src:=replace(src,original_fin,changed_fin);

 -- Each saleID counts once. Return IDs are separate negative events.
 IF strpos(src,'    wb_sales AS (')=0 THEN RAISE EXCEPTION 'WB sales CTE missing'; END IF;
 src:=replace(src,'    wb_sales AS (',
  '    wb_operational_verified AS ('||chr(10)||
  '      SELECT e.master_code,'||chr(10)||
  '        count(*) FILTER (WHERE NOT s.is_return)::integer sales_quantity,'||chr(10)||
  '        count(*) FILTER (WHERE s.is_return)::integer returns_quantity'||chr(10)||
  '      FROM public.china_wb_operational_sales s'||chr(10)||
  '      JOIN public.china_wb_operational_days d ON d.sale_day=s.sale_day'||chr(10)||
  '      JOIN eligible_listings e ON e.marketplace=''wildberries'''||
  ' AND e.external_id=s.nm_id::text'||chr(10)||
  '      WHERE s.sale_day BETWEEN v_date_from AND v_date_to'||chr(10)||
  '        AND NOT EXISTS (SELECT 1 FROM public.china_wb_feed_days f'||
  ' WHERE f.sale_day=s.sale_day)'||chr(10)||
  '      GROUP BY e.master_code'||chr(10)||
  '    ),'||chr(10)||chr(10)||
  '    wb_sales AS (');

 IF strpos(src,'         FROM wb_feed_verified'||chr(10)||'       ) c')=0 THEN
    RAISE EXCEPTION 'WB sources union moved';
 END IF;
 src:=replace(src,
  '         FROM wb_feed_verified'||chr(10)||'       ) c',
  '         FROM wb_feed_verified'||chr(10)||
  '         UNION ALL'||chr(10)||
  '         SELECT master_code,0::integer,0::integer,'||
  'sales_quantity,returns_quantity FROM wb_operational_verified'||chr(10)||
  '       ) c');

 src:=replace(src,
 'Ozon FBO + WB FBW confirmed buyout status from Order Feed, finance only for unverified dates + Yandex FBY net sales.',
 'Ozon FBO + WB FBW Order Feed / operational supplier sales / confirmed finance by exclusive days + Yandex FBY net sales.');

 EXECUTE src;
END
$patch$;
