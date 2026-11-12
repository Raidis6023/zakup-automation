-- Add existing catalog products or draft-only new products to a VED draft.
-- The only callable database role is service_role. The Next.js route checks the
-- actual session and permissions before invoking this transactional routine.
CREATE OR REPLACE FUNCTION public.ved_add_draft_items(
  p_order_id uuid,
  p_items jsonb,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_role text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_order public.ved_orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_mode text;
  v_product_id uuid;
  v_our_article text;
  v_chinese_article text;
  v_title text;
  v_price numeric;
  v_units integer;
  v_cartons integer;
  v_volume numeric;
  v_weight numeric;
  v_moq integer;
  v_quantity integer;
  v_row_id uuid;
  v_pos integer;
  v_added integer := 0;
  v_created jsonb := '[]'::jsonb;
BEGIN
  IF p_order_id IS NULL OR p_actor_id IS NULL OR nullif(btrim(p_actor_name),'') IS NULL THEN
    RAISE EXCEPTION 'Не указан заказ или сотрудник';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
     OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>50 THEN
    RAISE EXCEPTION 'Выберите от 1 до 50 товаров';
  END IF;

  SELECT * INTO v_order FROM public.ved_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заказ не найден'; END IF;
  IF v_order.workflow_status NOT IN ('draft','returned_for_edit') THEN
    RAISE EXCEPTION 'Добавление возможно только в черновик или возвращённый заказ';
  END IF;

  SELECT coalesce(max(position_sort),0) INTO v_pos
  FROM public.ved_order_items WHERE ved_order_id=p_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item)<>'object' THEN
      RAISE EXCEPTION 'Некорректный товар';
    END IF;
    v_mode := nullif(btrim(v_item->>'mode'),'');
    IF v_mode NOT IN ('catalog','new') OR v_mode IS NULL THEN
      RAISE EXCEPTION 'Выберите тип товара';
    END IF;

    v_cartons := 0;
    IF v_item ? 'cartons' AND v_item->>'cartons' IS NOT NULL AND btrim(v_item->>'cartons')<>'' THEN
      IF (v_item->>'cartons') !~ '^[0-9]{1,7}$' THEN
        RAISE EXCEPTION 'Количество коробов должно быть целым неотрицательным числом';
      END IF;
      v_cartons := (v_item->>'cartons')::integer;
      IF v_cartons > 100000 THEN
        RAISE EXCEPTION 'Количество коробов не может превышать 100 000';
      END IF;
    END IF;

    v_product_id := NULL; v_units := NULL; v_volume := NULL;
    v_weight := NULL; v_price := NULL; v_moq := NULL;
    v_our_article := NULL; v_chinese_article := NULL; v_title := NULL;

    IF v_mode='catalog' THEN
      IF coalesce(v_item->>'product_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
        RAISE EXCEPTION 'Неверный идентификатор товара каталога';
      END IF;
      v_product_id := (v_item->>'product_id')::uuid;
      SELECT * INTO v_product FROM public.products WHERE id=v_product_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Товар каталога больше не существует'; END IF;

      IF EXISTS(SELECT 1 FROM public.ved_order_items i
         WHERE i.ved_order_id=p_order_id AND i.product_id=v_product_id) THEN
        RAISE EXCEPTION 'Товар % уже присутствует в заказе. Измените его существующую строку',
          v_product.offer_id;
      END IF;

      v_our_article := v_product.offer_id;
      v_chinese_article := nullif(btrim(v_product.chinese_article),'');
      v_title := coalesce(nullif(btrim(v_product.name),''),v_product.offer_id);
      v_units := CASE WHEN v_product.units_per_carton>0 THEN v_product.units_per_carton ELSE NULL END;
      v_volume := coalesce(nullif(v_product.transport_carton_volume_m3,0),
                           nullif(v_product.carton_volume_m3,0));
      v_weight := nullif(v_product.carton_weight_kg,0);
      v_price := nullif(v_product.last_unit_price_cny,0);
      v_moq := nullif(v_product.last_moq,0);
    ELSE
      IF length(coalesce(btrim(v_item->>'name'),''))<2
         OR length(btrim(v_item->>'name'))>250 THEN
        RAISE EXCEPTION 'Название нового товара должно содержать от 2 до 250 символов';
      END IF;
      v_title := btrim(v_item->>'name');
      v_our_article := nullif(btrim(v_item->>'our_article'),'');
      v_chinese_article := nullif(btrim(v_item->>'chinese_article'),'');
      IF length(coalesce(v_our_article,''))>120 OR length(coalesce(v_chinese_article,''))>120 THEN
        RAISE EXCEPTION 'Длина артикула не может превышать 120 символов';
      END IF;

      IF EXISTS(SELECT 1 FROM public.ved_order_items i
          WHERE i.ved_order_id=p_order_id AND i.item_kind='new'
          AND ((v_our_article IS NOT NULL AND lower(btrim(i.our_article_snapshot))=lower(v_our_article))
            OR (v_our_article IS NULL AND lower(btrim(i.product_name_snapshot))=lower(v_title)))) THEN
        RAISE EXCEPTION 'Новый товар с таким артикулом или названием уже есть в заказе';
      END IF;

      IF nullif(btrim(v_item->>'units_per_carton'),'') IS NOT NULL THEN
        IF (v_item->>'units_per_carton') !~ '^[1-9][0-9]{0,6}$'
           OR (v_item->>'units_per_carton')::numeric>100000 THEN
          RAISE EXCEPTION 'Штук в коробке: укажите целое число от 1 до 100 000';
        END IF;
        v_units := (v_item->>'units_per_carton')::integer;
      END IF;
      IF nullif(btrim(v_item->>'carton_volume_m3'),'') IS NOT NULL THEN
        IF (v_item->>'carton_volume_m3') !~ '^[0-9]{1,7}(\.[0-9]{1,6})?$'
           OR (v_item->>'carton_volume_m3')::numeric<=0
           OR (v_item->>'carton_volume_m3')::numeric>1000 THEN
          RAISE EXCEPTION 'Некорректный объём короба, м³';
        END IF;
        v_volume := (v_item->>'carton_volume_m3')::numeric;
      END IF;
      IF nullif(btrim(v_item->>'carton_weight_kg'),'') IS NOT NULL THEN
        IF (v_item->>'carton_weight_kg') !~ '^[0-9]{1,7}(\.[0-9]{1,4})?$'
           OR (v_item->>'carton_weight_kg')::numeric<=0
           OR (v_item->>'carton_weight_kg')::numeric>10000 THEN
          RAISE EXCEPTION 'Некорректный вес короба, кг';
        END IF;
        v_weight := (v_item->>'carton_weight_kg')::numeric;
      END IF;
      IF nullif(btrim(v_item->>'unit_price_cny'),'') IS NOT NULL THEN
        IF (v_item->>'unit_price_cny') !~ '^[0-9]{1,10}(\.[0-9]{1,4})?$'
           OR (v_item->>'unit_price_cny')::numeric<=0 THEN
          RAISE EXCEPTION 'Некорректная цена за штуку в юанях';
        END IF;
        v_price := (v_item->>'unit_price_cny')::numeric;
      END IF;
    END IF;

    IF v_cartons>0 AND v_units IS NULL THEN
      RAISE EXCEPTION 'Для товара % укажите количество штук в коробке перед вводом коробов',v_title;
    END IF;
    v_quantity := coalesce(v_units,0)*v_cartons;
    IF v_quantity > 100000000 THEN
      RAISE EXCEPTION 'Слишком большое количество товара в заказе';
    END IF;

    v_pos := v_pos+1;
    INSERT INTO public.ved_order_items(
      ved_order_id,product_id,status,item_kind,quantity,
      chinese_article_snapshot,our_article_snapshot,product_name_snapshot,photo_url,
      priority_group,position_sort,moq_quantity,unit_price_cny,
      units_per_carton_snapshot,carton_volume_m3_snapshot,carton_weight_kg_snapshot,
      cartons,order_quantity,manual_cartons_override,
      total_price_cny,total_volume_m3,total_weight_tons
    ) VALUES (
      p_order_id,v_product_id,'draft',CASE WHEN v_mode='catalog' THEN 'existing' ELSE 'new' END,0,
      v_chinese_article,v_our_article,v_title,
      CASE WHEN v_mode='catalog' THEN v_product.main_photo_url ELSE NULL END,
      CASE WHEN v_mode='catalog' THEN 'normal' ELSE 'new' END,v_pos,v_moq,v_price,
      v_units,v_volume,v_weight,
      CASE WHEN v_cartons>0 THEN v_cartons ELSE NULL END,v_quantity,v_cartons>0,
      CASE WHEN v_quantity>0 AND v_price IS NOT NULL THEN round(v_quantity*v_price,2) ELSE NULL END,
      CASE WHEN v_cartons>0 AND v_volume IS NOT NULL THEN round(v_cartons*v_volume,6) ELSE NULL END,
      CASE WHEN v_cartons>0 AND v_weight IS NOT NULL THEN round(v_cartons*v_weight/1000,6) ELSE NULL END
    ) RETURNING id INTO v_row_id;

    INSERT INTO public.ved_order_audit_log(
      ved_order_id,ved_order_item_id,event_type,field_name,
      new_value,actor_user_id,actor_name,actor_role,metadata
    ) VALUES (
      p_order_id,v_row_id,'item_added','composition',
      jsonb_build_object('mode',v_mode,'product_id',v_product_id,'name',v_title,'cartons',v_cartons),
      p_actor_id,p_actor_name,p_actor_role,
      jsonb_build_object('source','draft_composition_modal')
    );

    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'id',v_row_id,'mode',v_mode,'name',v_title));
    v_added := v_added+1;
  END LOOP;

  UPDATE public.ved_orders SET updated_at=now() WHERE id=p_order_id;
  RETURN jsonb_build_object('ok',true,'added',v_added,'items',v_created);
END
$fn$;

REVOKE ALL ON FUNCTION public.ved_add_draft_items(uuid,jsonb,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_add_draft_items(uuid,jsonb,uuid,text,text) TO service_role;
