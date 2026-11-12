-- One supplier calculation worksheet = one manually-added order line.
-- Private photos and original Excel remain order scoped and audit-traceable.
ALTER TABLE public.ved_order_items
 ADD COLUMN IF NOT EXISTS import_excel_source_path text,
 ADD COLUMN IF NOT EXISTS import_excel_sheet text,
 ADD COLUMN IF NOT EXISTS import_product_photo_path text,
 ADD COLUMN IF NOT EXISTS import_hs_code text,
 ADD COLUMN IF NOT EXISTS import_carton_length_cm numeric,
 ADD COLUMN IF NOT EXISTS import_carton_width_cm numeric,
 ADD COLUMN IF NOT EXISTS import_carton_height_cm numeric,
 ADD COLUMN IF NOT EXISTS import_individual_length_cm numeric,
 ADD COLUMN IF NOT EXISTS import_individual_width_cm numeric,
 ADD COLUMN IF NOT EXISTS import_individual_height_cm numeric;

-- Existing manual entry should not reject distinct Chinese variants that share
-- a generic product name. Prefer identifiers; compare title only if both absent.
DO $patch_existing$
DECLARE src text; fixed text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO src FROM pg_proc WHERE proname='ved_add_draft_items'
 AND pronamespace='public'::regnamespace;
 fixed:=replace(src,
  'OR (v_our_article IS NULL AND lower(btrim(i.product_name_snapshot))=lower(v_title))))',
  'OR (v_chinese_article IS NOT NULL AND lower(btrim(i.chinese_article_snapshot))=lower(v_chinese_article))'
  ||chr(10)||'            OR (v_our_article IS NULL AND v_chinese_article IS NULL AND lower(btrim(i.product_name_snapshot))=lower(v_title))))');
 IF fixed=src THEN RAISE EXCEPTION 'Manual draft duplicate guard changed'; END IF;
 EXECUTE fixed;
END
$patch_existing$;

CREATE OR REPLACE FUNCTION public.ved_import_excel_draft_items(
 p_order_id uuid,p_source_path text,p_items jsonb,
 p_actor_id uuid,p_actor_name text,p_actor_role text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
 v_payload jsonb := '[]'::jsonb;
 v_item jsonb;
 v_added jsonb;
 v_created jsonb;
 v_id uuid;
 v_sheet text;
 v_photo_path text;
 v_index int := 0;
 v_field text;
 v_value text;
 v_moq integer;
 v_numeric numeric;
 v_product_id uuid;
BEGIN
 IF p_source_path !~ ('^ved-order-imports/'||p_order_id::text||'/[a-f0-9-]{36}/source[.]xlsx$') THEN
    RAISE EXCEPTION 'Неверный путь исходного Excel';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
   OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>50 THEN
    RAISE EXCEPTION 'Выберите от 1 до 50 товарных листов';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_index:=v_index+1;
   IF jsonb_typeof(v_item)<>'object' OR v_item->>'mode'<>'new' THEN
     RAISE EXCEPTION 'Excel импортирует новые позиции, без автоматической привязки ЕНОТ';
   END IF;
   v_sheet:=nullif(btrim(v_item->>'sheet'),'');
   IF v_sheet IS NULL OR length(v_sheet)>31 THEN
     RAISE EXCEPTION 'Неверное название листа Excel';
   END IF;
   IF EXISTS(SELECT 1 FROM public.ved_order_items i WHERE i.ved_order_id=p_order_id
     AND i.import_excel_source_path=p_source_path AND i.import_excel_sheet=v_sheet) THEN
     RAISE EXCEPTION 'Лист % уже импортирован в этот заказ',v_sheet;
   END IF;
   v_photo_path:=nullif(btrim(v_item->>'photo_storage_path'),'');
   IF v_photo_path IS NOT NULL AND
     v_photo_path !~ ('^ved-orders/'||p_order_id::text||'/[a-f0-9-]{36}/[0-9]{1,3}[.]webp$') THEN
     RAISE EXCEPTION 'Неверное расположение фотографии';
   END IF;
   v_payload:=v_payload || jsonb_build_array(
     (v_item - 'sheet' - 'photo_storage_path' - 'moq_quantity'
       - 'carton_length_cm' - 'carton_width_cm' - 'carton_height_cm'
       - 'individual_length_cm' - 'individual_width_cm' - 'individual_height_cm'
       - 'hs_code') || jsonb_build_object('mode','new')
   );
 END LOOP;

 -- One atomic transaction, including duplicates and generated totals.
 v_added:=public.ved_add_draft_items(
   p_order_id,v_payload,p_actor_id,p_actor_name,p_actor_role
 );
 IF coalesce((v_added->>'added')::int,0)<>v_index THEN
    RAISE EXCEPTION 'Не все позиции импортированы';
 END IF;

 v_index:=0;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_index:=v_index+1;
   v_id:=(v_added->'items'->(v_index-1)->>'id')::uuid;
   v_sheet:=v_item->>'sheet';
   v_photo_path:=nullif(btrim(v_item->>'photo_storage_path'),'');

   -- Validate every extra numeric field BEFORE converting to numeric to
   -- prevent bad user-edited Excel previews from half-saving an order.
   FOREACH v_field IN ARRAY ARRAY[
     'moq_quantity','carton_length_cm','carton_width_cm','carton_height_cm',
     'individual_length_cm','individual_width_cm','individual_height_cm'
   ] LOOP
     v_value:=nullif(btrim(v_item->>v_field),'');
     IF v_value IS NOT NULL AND (v_value !~ '^[0-9]{1,7}([.][0-9]{1,6})?$'
       OR v_value::numeric<=0 OR v_value::numeric>100000) THEN
       RAISE EXCEPTION 'Некорректное значение поля % на листе %',v_field,v_sheet;
     END IF;
   END LOOP;

   v_value:=nullif(btrim(v_item->>'moq_quantity'),'');
   IF v_value IS NOT NULL AND (v_value !~ '^[1-9][0-9]{0,7}$' OR v_value::numeric>10000000) THEN
     RAISE EXCEPTION 'MOQ должен быть целым числом на листе %',v_sheet;
   END IF;

   UPDATE public.ved_order_items i SET
     import_excel_source_path=p_source_path,
     import_excel_sheet=v_sheet,
     import_product_photo_path=v_photo_path,
     photo_url=CASE WHEN v_photo_path IS NOT NULL
       THEN '/api/ved-orders/'||p_order_id::text||'/excel-photo/'||v_id::text
       ELSE NULL END,
     moq_quantity=CASE WHEN v_value IS NOT NULL THEN v_value::int ELSE NULL END,
     import_hs_code=nullif(regexp_replace(coalesce(v_item->>'hs_code',''),'[^0-9]','','g'),''),
     import_carton_length_cm=nullif(v_item->>'carton_length_cm','')::numeric,
     import_carton_width_cm=nullif(v_item->>'carton_width_cm','')::numeric,
     import_carton_height_cm=nullif(v_item->>'carton_height_cm','')::numeric,
     import_individual_length_cm=nullif(v_item->>'individual_length_cm','')::numeric,
     import_individual_width_cm=nullif(v_item->>'individual_width_cm','')::numeric,
     import_individual_height_cm=nullif(v_item->>'individual_height_cm','')::numeric
   WHERE i.id=v_id AND i.ved_order_id=p_order_id AND i.added_manually;
   IF NOT FOUND THEN RAISE EXCEPTION 'Не найдена добавленная позиция %',v_id; END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'added',v_index,'items',v_added->'items');
END
$fn$;

REVOKE ALL ON FUNCTION public.ved_import_excel_draft_items(uuid,text,jsonb,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_import_excel_draft_items(uuid,text,jsonb,uuid,text,text)
 TO service_role;
