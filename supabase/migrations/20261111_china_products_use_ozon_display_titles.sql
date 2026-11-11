-- Expose the same product title that the Ozon products page displays.
-- get_ozon_sync_dashboard uses MIN(products.name) among active products
-- grouped by master_code. The procurement dashboard now exposes that name
-- under ozon_name without changing any inventory, demand or sales totals.

DO $china_products_ozon_title$
DECLARE
  v_def text;
  v_cte_old text := 'latest_manual AS (';
  v_cte_new text := $new_cte$ozon_catalog_names AS (
    SELECT p.master_code, min(p.name) AS product_name
    FROM public.products p
    WHERE p.is_active = TRUE
      AND p.master_code IS NOT NULL
      AND btrim(p.master_code) <> ''
    GROUP BY p.master_code
),

latest_manual AS ($new_cte$;
  v_title_old text := $old_title$                        'offer_id', p.offer_id,
                        'name', p.name,$old_title$;
  v_title_new text := $new_title$                        'offer_id', p.offer_id,
                        'name', p.name,
                        'ozon_name', ozon_catalog_names.product_name,$new_title$;
  v_join_old text := $old_join$    JOIN latest_run r
        ON r.id = i.calculation_run_id

    LEFT JOIN latest_manual container_manual$old_join$;
  v_join_new text := $new_join$    JOIN latest_run r
        ON r.id = i.calculation_run_id

    LEFT JOIN ozon_catalog_names
        ON ozon_catalog_names.master_code = p.master_code

    LEFT JOIN latest_manual container_manual$new_join$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  WHERE p.pronamespace='public'::regnamespace
    AND p.proname='get_china_dashboard'
    AND pg_get_function_identity_arguments(p.oid)='';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_china_dashboard not found';
  END IF;

  IF strpos(v_def, '''ozon_name'', ozon_catalog_names.product_name')>0 THEN
    RETURN;
  END IF;

  IF strpos(v_def,v_cte_old)=0
     OR strpos(v_def,v_title_old)=0
     OR strpos(v_def,v_join_old)=0 THEN
    RAISE EXCEPTION 'get_china_dashboard changed; cannot add Ozon title safely';
  END IF;

  v_def := replace(v_def,v_cte_old,v_cte_new);
  v_def := replace(v_def,v_title_old,v_title_new);
  v_def := replace(v_def,v_join_old,v_join_new);
  EXECUTE v_def;
END
$china_products_ozon_title$;
