-- Two confirmed preparation blocks before VED handoff.
-- All edits belong to the order snapshot, never overwrite the shared product catalog.
ALTER TABLE public.ved_order_items
  ADD COLUMN IF NOT EXISTS characteristics_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS characteristics_confirmed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS order_terms_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_terms_confirmed_by_user_id uuid;

CREATE OR REPLACE FUNCTION public.ved_block_number(
  p_raw text, p_name text, p_integer boolean DEFAULT false,
  p_required boolean DEFAULT true
) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $numeric$
DECLARE v_raw text := btrim(coalesce(p_raw,'')); v_num numeric;
BEGIN
 IF v_raw='' THEN
   IF p_required THEN RAISE EXCEPTION '%: заполните поле',p_name; END IF;
   RETURN NULL;
 END IF;
 v_raw:=replace(replace(v_raw,' ',''),',','.');
 IF v_raw !~ '^[0-9]{1,10}([.][0-9]{1,6})?$' THEN
   RAISE EXCEPTION '%: требуется положительное число',p_name;
 END IF;
 v_num:=v_raw::numeric;
 IF v_num<=0 OR v_num>100000000 THEN
   RAISE EXCEPTION '%: значение вне допустимого диапазона',p_name;
 END IF;
 IF p_integer AND v_num<>trunc(v_num) THEN
   RAISE EXCEPTION '%: требуется целое число',p_name;
 END IF;
 RETURN v_num;
END
$numeric$;

REVOKE ALL ON FUNCTION public.ved_block_number(text,text,boolean,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_block_number(text,text,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.ved_confirm_preparation_block(
  p_item_id uuid,p_block text,p_payload jsonb,
  p_actor_id uuid,p_actor_name text,p_actor_role text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $confirm$
DECLARE
 v_order public.ved_orders%rowtype;
 v_item public.ved_order_items%rowtype;
 v_name text; v_chinese text; v_hs text;
 v_units integer; v_weight numeric; v_volume numeric;
 v_l numeric; v_w numeric; v_h numeric;
 v_il numeric; v_iw numeric; v_ih numeric;
 v_moq integer; v_price numeric; v_cartons integer; v_quantity numeric;
 v_old jsonb; v_new jsonb; v_now timestamptz:=now();
BEGIN
 IF p_item_id IS NULL OR p_actor_id IS NULL OR nullif(btrim(p_actor_name),'') IS NULL THEN
   RAISE EXCEPTION 'Не указан сотрудник или товар';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR
    p_block NOT IN ('characteristics','terms') THEN
   RAISE EXCEPTION 'Неверный блок подтверждения';
 END IF;
 SELECT * INTO v_item FROM public.ved_order_items WHERE id=p_item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Позиция заказа не найдена'; END IF;
 SELECT * INTO v_order FROM public.ved_orders WHERE id=v_item.ved_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Заказ не найден'; END IF;
 IF v_order.workflow_status NOT IN ('draft','returned_for_edit') THEN
   RAISE EXCEPTION 'Подтверждение возможно только до передачи в ВЭД';
 END IF;
 SELECT * INTO v_item FROM public.ved_order_items WHERE id=p_item_id FOR UPDATE;
 IF v_item.moq_review_status='rejected' THEN
   RAISE EXCEPTION 'Исключённую позицию сначала нужно вернуть в заказ';
 END IF;

 IF p_block='characteristics' THEN
   v_name:=nullif(btrim(p_payload->>'name'),'');
   v_chinese:=nullif(btrim(p_payload->>'chineseArticle'),'');
   IF v_name IS NULL OR length(v_name)>250 THEN
     RAISE EXCEPTION 'Укажите название товара (до 250 символов)';
   END IF;
   IF v_chinese IS NULL OR length(v_chinese)>120 THEN
     RAISE EXCEPTION 'Укажите китайский артикул (до 120 символов)';
   END IF;
   IF nullif(btrim(coalesce(v_item.photo_url,'')),'') IS NULL THEN
     RAISE EXCEPTION 'Добавьте фотографию товара перед подтверждением характеристик';
   END IF;
   v_units:=public.ved_block_number(p_payload->>'unitsPerCarton','Штук в коробке',true)::integer;
   IF v_units>100000 THEN RAISE EXCEPTION 'Вложимость не должна превышать 100 000'; END IF;
   v_weight:=public.ved_block_number(p_payload->>'cartonWeightKg','Вес транспортного короба');
   v_l:=public.ved_block_number(p_payload->>'cartonLengthCm','Длина короба',false,false);
   v_w:=public.ved_block_number(p_payload->>'cartonWidthCm','Ширина короба',false,false);
   v_h:=public.ved_block_number(p_payload->>'cartonHeightCm','Высота короба',false,false);
   IF (v_l IS NOT NULL OR v_w IS NOT NULL OR v_h IS NOT NULL)
     AND (v_l IS NULL OR v_w IS NULL OR v_h IS NULL) THEN
     RAISE EXCEPTION 'Для расчёта объёма заполните все три габарита транспортного короба';
   END IF;
   IF v_l IS NOT NULL THEN
     v_volume:=round(v_l*v_w*v_h/1000000,6);
     IF v_volume<=0 THEN RAISE EXCEPTION 'Объём короба меньше точности расчёта'; END IF;
   ELSE
     v_volume:=public.ved_block_number(p_payload->>'cartonVolumeM3','Объём транспортного короба');
   END IF;
   v_il:=public.ved_block_number(p_payload->>'individualLengthCm','Длина индивидуальной упаковки',false,false);
   v_iw:=public.ved_block_number(p_payload->>'individualWidthCm','Ширина индивидуальной упаковки',false,false);
   v_ih:=public.ved_block_number(p_payload->>'individualHeightCm','Высота индивидуальной упаковки',false,false);
   v_hs:=nullif(regexp_replace(coalesce(p_payload->>'hsCode',''),'[^0-9]','','g'),'');
   IF v_hs IS NOT NULL AND length(v_hs)>14 THEN RAISE EXCEPTION 'Слишком длинный код ТН ВЭД'; END IF;

   v_old:=jsonb_build_object('name',v_item.product_name_snapshot,'chinese_article',v_item.chinese_article_snapshot,
     'units_per_carton',v_item.units_per_carton_snapshot,'carton_volume_m3',v_item.carton_volume_m3_snapshot,
     'carton_weight_kg',v_item.carton_weight_kg_snapshot,'photo_url',v_item.photo_url);
   IF coalesce(v_item.cartons,0)::numeric * v_units > 100000000 THEN
     RAISE EXCEPTION 'Слишком большая партия после изменения вложимости';
   END IF;
   UPDATE public.ved_order_items SET
     product_name_snapshot=v_name,chinese_article_snapshot=v_chinese,
     units_per_carton_snapshot=v_units,carton_volume_m3_snapshot=v_volume,
     carton_weight_kg_snapshot=v_weight,
     import_carton_length_cm=v_l,import_carton_width_cm=v_w,import_carton_height_cm=v_h,
     import_individual_length_cm=v_il,import_individual_width_cm=v_iw,
     import_individual_height_cm=v_ih,import_hs_code=v_hs,
     characteristics_confirmed_at=v_now,characteristics_confirmed_by_user_id=p_actor_id,
     -- A changed pack size changes the ordered quantity and invalidates prior commercial confirmation.
     order_terms_confirmed_at=CASE
       WHEN v_item.units_per_carton_snapshot IS DISTINCT FROM v_units
        OR v_item.carton_volume_m3_snapshot IS DISTINCT FROM v_volume
        OR v_item.carton_weight_kg_snapshot IS DISTINCT FROM v_weight
       THEN NULL ELSE order_terms_confirmed_at END,
     moq_confirmed_at=CASE
       WHEN v_item.units_per_carton_snapshot IS DISTINCT FROM v_units
        OR v_item.carton_volume_m3_snapshot IS DISTINCT FROM v_volume
        OR v_item.carton_weight_kg_snapshot IS DISTINCT FROM v_weight
       THEN NULL ELSE moq_confirmed_at END,
     price_confirmed_at=CASE
       WHEN v_item.units_per_carton_snapshot IS DISTINCT FROM v_units
        OR v_item.carton_volume_m3_snapshot IS DISTINCT FROM v_volume
        OR v_item.carton_weight_kg_snapshot IS DISTINCT FROM v_weight
       THEN NULL ELSE price_confirmed_at END,
     order_quantity=coalesce(v_item.cartons,0)*v_units,
     updated_at=v_now
   WHERE id=p_item_id;
   v_new:=jsonb_build_object('name',v_name,'chinese_article',v_chinese,
     'units_per_carton',v_units,'carton_volume_m3',v_volume,'carton_weight_kg',v_weight,
     'carton_length_cm',v_l,'carton_width_cm',v_w,'carton_height_cm',v_h,
     'individual_length_cm',v_il,'individual_width_cm',v_iw,'individual_height_cm',v_ih,
     'hs_code',v_hs);
 ELSE
   IF v_item.characteristics_confirmed_at IS NULL THEN
     RAISE EXCEPTION 'Сначала подтвердите характеристики товара';
   END IF;
   IF v_item.units_per_carton_snapshot IS NULL OR v_item.units_per_carton_snapshot<=0 THEN
     RAISE EXCEPTION 'Укажите вложимость короба';
   END IF;
   v_moq:=public.ved_block_number(p_payload->>'moq','MOQ',true)::integer;
   v_price:=public.ved_block_number(p_payload->>'priceCny','Цена за штуку, CNY');
   v_cartons:=public.ved_block_number(p_payload->>'cartons','Количество коробов',true)::integer;
   IF v_cartons>100000 THEN RAISE EXCEPTION 'Не более 100 000 коробов'; END IF;
   v_quantity:=v_cartons::numeric*v_item.units_per_carton_snapshot;
   IF v_quantity>100000000 THEN RAISE EXCEPTION 'Слишком большая партия'; END IF;
   IF v_quantity<v_moq THEN
     RAISE EXCEPTION 'Выбрано % шт., MOQ % шт. Минимум % коробов',
       v_quantity::bigint,v_moq,ceil(v_moq::numeric/v_item.units_per_carton_snapshot)::integer;
   END IF;
   v_old:=jsonb_build_object('moq',v_item.moq_quantity,'price',v_item.unit_price_cny,
     'cartons',v_item.cartons,'order_quantity',v_item.order_quantity);
   UPDATE public.ved_order_items SET
     moq_quantity=v_moq,unit_price_cny=v_price,cartons=v_cartons,
     order_quantity=v_quantity::integer,manual_cartons_override=true,
     moq_confirmed_at=v_now,price_confirmed_at=v_now,
     moq_confirmed_by_user_id=p_actor_id,price_confirmed_by_user_id=p_actor_id,
     order_terms_confirmed_at=v_now,order_terms_confirmed_by_user_id=p_actor_id,
     moq_excess_review_required=false,moq_review_status='not_required',
     coverage_after_order_days=NULL,
     is_partial_fill=coalesce(v_item.selected_demand_units>0,false) AND
       v_quantity<v_item.selected_demand_units,
     partial_fill_confirmed_at=CASE WHEN v_item.selected_demand_units>0 AND
       v_quantity<v_item.selected_demand_units THEN v_now ELSE NULL END,
     partial_fill_confirmed_by_user_id=CASE WHEN v_item.selected_demand_units>0 AND
       v_quantity<v_item.selected_demand_units THEN p_actor_id ELSE NULL END,
     updated_at=v_now
   WHERE id=p_item_id;
   v_new:=jsonb_build_object('moq',v_moq,'price',v_price,'cartons',v_cartons,
     'order_quantity',v_quantity::integer);
 END IF;

 UPDATE public.ved_orders SET updated_at=v_now WHERE id=v_item.ved_order_id;
 INSERT INTO public.ved_order_audit_log(
   ved_order_id,ved_order_item_id,event_type,field_name,old_value,new_value,
   actor_user_id,actor_name,actor_role,metadata
 ) VALUES (
   v_item.ved_order_id,v_item.id,'preparation_block_confirmed',p_block,v_old,v_new,
   p_actor_id,btrim(p_actor_name),p_actor_role,
   jsonb_build_object('two_block_workflow',true,'without_incoterm',true)
 );
 RETURN jsonb_build_object('ok',true,'block',p_block,'item_id',p_item_id,'confirmed_at',v_now);
END
$confirm$;

REVOKE ALL ON FUNCTION public.ved_confirm_preparation_block(uuid,text,jsonb,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_confirm_preparation_block(uuid,text,jsonb,uuid,text,text)
 TO service_role;

-- Keep already transferred orders readable/exportable; require fresh two-block
-- confirmation on editable drafts (no silent auto-confirmation on draft rows).
UPDATE public.ved_order_items i SET
  characteristics_confirmed_at=coalesce(i.moq_confirmed_at,i.price_confirmed_at,i.updated_at),
  order_terms_confirmed_at=coalesce(i.price_confirmed_at,i.moq_confirmed_at,i.updated_at)
FROM public.ved_orders o
WHERE o.id=i.ved_order_id AND o.workflow_status NOT IN ('draft','returned_for_edit')
  AND i.moq_review_status<>'rejected'
  AND i.order_quantity>0 AND coalesce(i.cartons,0)>0
  AND nullif(btrim(coalesce(i.chinese_article_snapshot,'')),'') IS NOT NULL
  AND nullif(btrim(coalesce(i.product_name_snapshot,'')),'') IS NOT NULL
  AND nullif(btrim(coalesce(i.photo_url,'')),'') IS NOT NULL
  AND i.units_per_carton_snapshot>0 AND i.carton_volume_m3_snapshot>0
  AND i.carton_weight_kg_snapshot>0 AND i.moq_quantity>0 AND i.unit_price_cny>0
  AND i.moq_confirmed_at IS NOT NULL AND i.price_confirmed_at IS NOT NULL
  AND i.characteristics_confirmed_at IS NULL AND i.order_terms_confirmed_at IS NULL;

-- Single source of truth used both by the UI and send_ved_order_to_ved().
CREATE OR REPLACE FUNCTION public.get_ved_order_handoff_readiness(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $ready$
DECLARE
 v_order public.ved_orders%rowtype;
 v_total integer; v_excluded integer; v_active integer; v_included integer;
 v_characteristics_pending integer; v_terms_pending integer;
 v_missing_chinese integer;v_missing_name integer;v_missing_photo integer;
 v_missing_units integer;v_missing_volume integer;v_missing_weight integer;
 v_missing_cartons integer;v_missing_quantity integer;
 v_problems jsonb;v_ready boolean;
BEGIN
 SELECT * INTO v_order FROM public.ved_orders WHERE id=p_order_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Заказ не найден'; END IF;
 SELECT count(*),count(*) FILTER(WHERE moq_review_status='rejected'),
   count(*) FILTER(WHERE moq_review_status<>'rejected'),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND order_quantity>0),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND characteristics_confirmed_at IS NULL),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND order_terms_confirmed_at IS NULL),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND nullif(btrim(coalesce(chinese_article_snapshot,'')),'') IS NULL),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND nullif(btrim(coalesce(product_name_snapshot,'')),'') IS NULL),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND nullif(btrim(coalesce(photo_url,'')),'') IS NULL),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND coalesce(units_per_carton_snapshot,0)<=0),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND coalesce(carton_volume_m3_snapshot,0)<=0),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND coalesce(carton_weight_kg_snapshot,0)<=0),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND coalesce(cartons,0)<=0),
   count(*) FILTER(WHERE moq_review_status<>'rejected' AND order_quantity<=0)
 INTO v_total,v_excluded,v_active,v_included,v_characteristics_pending,v_terms_pending,
   v_missing_chinese,v_missing_name,v_missing_photo,v_missing_units,v_missing_volume,
   v_missing_weight,v_missing_cartons,v_missing_quantity
 FROM public.ved_order_items WHERE ved_order_id=p_order_id;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'item_id',q.id,'our_article',q.our_article_snapshot,
   'product_name',q.product_name_snapshot,'problems',q.problems
 ) ORDER BY q.position_sort NULLS LAST,q.product_name_snapshot),'[]'::jsonb)
 INTO v_problems
 FROM (
   SELECT i.id,i.our_article_snapshot,i.product_name_snapshot,i.position_sort,
     array_remove(ARRAY[
       CASE WHEN i.characteristics_confirmed_at IS NULL THEN 'Не подтверждён блок «Характеристики товара»' END,
       CASE WHEN i.order_terms_confirmed_at IS NULL THEN 'Не подтверждён блок «Условия заказа»' END,
       CASE WHEN nullif(btrim(coalesce(i.chinese_article_snapshot,'')),'') IS NULL THEN 'Нет китайского артикула' END,
       CASE WHEN nullif(btrim(coalesce(i.product_name_snapshot,'')),'') IS NULL THEN 'Нет наименования' END,
       CASE WHEN nullif(btrim(coalesce(i.photo_url,'')),'') IS NULL THEN 'Нет фото' END,
       CASE WHEN coalesce(i.units_per_carton_snapshot,0)<=0 THEN 'Нет вложимости короба' END,
       CASE WHEN coalesce(i.carton_volume_m3_snapshot,0)<=0 THEN 'Нет объёма транспортного короба' END,
       CASE WHEN coalesce(i.carton_weight_kg_snapshot,0)<=0 THEN 'Нет веса транспортного короба' END,
       CASE WHEN coalesce(i.cartons,0)<=0 THEN 'Не указаны короба к заказу' END,
       CASE WHEN i.order_quantity<=0 THEN 'Не указано количество к заказу' END,
       CASE WHEN i.moq_quantity IS NULL OR i.moq_quantity<=0 THEN 'Не указан MOQ' END,
       CASE WHEN i.unit_price_cny IS NULL OR i.unit_price_cny<=0 THEN 'Не указана закупочная цена' END
     ]::text[],NULL) AS problems
   FROM public.ved_order_items i
   WHERE i.ved_order_id=p_order_id AND i.moq_review_status<>'rejected'
 )q WHERE cardinality(q.problems)>0;

 v_ready:=v_total>0 AND v_active>0 AND v_included>0
   AND v_characteristics_pending=0 AND v_terms_pending=0
   AND v_missing_chinese=0 AND v_missing_name=0 AND v_missing_photo=0
   AND v_missing_units=0 AND v_missing_volume=0 AND v_missing_weight=0
   AND v_missing_cartons=0 AND v_missing_quantity=0
   AND jsonb_array_length(v_problems)=0;

 RETURN jsonb_build_object(
  'ok',true,'order_id',p_order_id,'workflow_status',v_order.workflow_status,
  'ready',v_ready,'total_items',v_total,'included_items',v_included,'excluded_items',v_excluded,
  'blockers',jsonb_build_object(
    'characteristics_pending',v_characteristics_pending,
    'order_block_pending',v_terms_pending,
    'terms_pending',v_terms_pending,
    'moq_review_pending',0,
    'missing_chinese_article',v_missing_chinese,
    'missing_name',v_missing_name,
    'missing_photo',v_missing_photo,
    'missing_units_per_carton',v_missing_units,
    'missing_carton_volume',v_missing_volume,
    'missing_carton_weight',v_missing_weight,
    'missing_cartons',v_missing_cartons,
    'missing_order_quantity',v_missing_quantity,
    'missing_incoterm',0
  ),
  'problem_items',v_problems
 );
END
$ready$;
