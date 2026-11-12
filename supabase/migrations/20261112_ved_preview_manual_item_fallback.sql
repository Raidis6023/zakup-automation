-- Existing VED edit and MOQ-review paths call the legacy preview directly.
-- Route manually added lines through the non-demand preview as well, so no
-- later editing operation can produce a NULL order_quantity via the old math.
DO $patch$
DECLARE
 v_original text;
 v_updated text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_original
 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
   AND p.proname='ved_manual_item_terms';
 IF v_original IS NULL THEN RAISE EXCEPTION 'Manual terms handler is missing'; END IF;
 v_updated:=replace(
   v_original,
   'IF v_order.workflow_status NOT IN (''draft'',''returned_for_edit'') THEN',
   'IF p_confirm AND v_order.workflow_status NOT IN (''draft'',''returned_for_edit'') THEN'
 );
 IF v_updated=v_original THEN RAISE EXCEPTION 'Status guard changed'; END IF;
 EXECUTE v_updated;

 SELECT pg_get_functiondef(p.oid) INTO v_original
 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
   AND p.proname='preview_ved_order_item_terms';
 IF v_original IS NULL THEN RAISE EXCEPTION 'Legacy preview handler is missing'; END IF;
 IF position('public.ved_manual_item_terms(' in v_original)>0 THEN
   RAISE EXCEPTION 'Manual preview protection already exists';
 END IF;
 v_updated:=replace(
   v_original,
   '-- 5. ЦЕЛЕВОЙ ГОРИЗОНТ',
   '-- Ручная позиция не имеет рассчитанной потребности; нельзя умножать NULL.'
   ||chr(10)||'    if v_item.added_manually and v_item.selected_demand_units is null then'
   ||chr(10)||'        return public.ved_manual_item_terms('
   ||chr(10)||'            p_item_id,p_moq_quantity,p_unit_price_cny,coalesce(v_item.cartons,0),'
   ||chr(10)||'            false,null,null,null);'
   ||chr(10)||'    end if;'
   ||chr(10)||'    -- 5. ЦЕЛЕВОЙ ГОРИЗОНТ'
 );
 IF v_updated=v_original THEN RAISE EXCEPTION 'Legacy preview insertion point changed'; END IF;
 EXECUTE v_updated;
END
$patch$;
