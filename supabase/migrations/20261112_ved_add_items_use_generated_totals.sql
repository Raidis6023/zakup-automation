DO $patch$
DECLARE source text; corrected text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO source
 FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname='ved_add_draft_items';
 IF source IS NULL THEN RAISE EXCEPTION 'Add draft items function missing'; END IF;
 corrected:=replace(source,'
      cartons,order_quantity,manual_cartons_override,
      total_price_cny,total_volume_m3,total_weight_tons
    ) VALUES (','
      cartons,order_quantity,manual_cartons_override
    ) VALUES (');
 IF corrected=source THEN RAISE EXCEPTION 'Insert field list has changed'; END IF;
 source:=corrected;
 corrected:=replace(source,'
      CASE WHEN v_cartons>0 THEN v_cartons ELSE NULL END,v_quantity,v_cartons>0,
      CASE WHEN v_quantity>0 AND v_price IS NOT NULL THEN round(v_quantity*v_price,2) ELSE NULL END,
      CASE WHEN v_cartons>0 AND v_volume IS NOT NULL THEN round(v_cartons*v_volume,6) ELSE NULL END,
      CASE WHEN v_cartons>0 AND v_weight IS NOT NULL THEN round(v_cartons*v_weight/1000,6) ELSE NULL END
    ) RETURNING id','
      CASE WHEN v_cartons>0 THEN v_cartons ELSE NULL END,v_quantity,v_cartons>0
    ) RETURNING id');
 IF corrected=source THEN RAISE EXCEPTION 'Generated totals insert expression moved'; END IF;
 EXECUTE corrected;
END
$patch$;