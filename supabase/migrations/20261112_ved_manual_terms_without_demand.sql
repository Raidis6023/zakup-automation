-- Manually added procurement order lines (including Excel imports and catalog picks)
-- have no calculated demand. Do NOT pass them through preview_ved_order_item_terms,
-- which multiplies NULL selected_demand_units and produces a NULL order_quantity.
--
-- A manually entered 0 carton count confirms MOQ/price only; it NEVER orders
-- the MOQ automatically. The employee later enters actual cartons explicitly.
CREATE OR REPLACE FUNCTION public.ved_manual_item_terms(
  p_item_id uuid,
  p_moq_quantity integer,
  p_unit_price_cny numeric,
  p_cartons integer,
  p_confirm boolean,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $manual$
DECLARE
  v_item public.ved_order_items%rowtype;
  v_order public.ved_orders%rowtype;
  v_quantity numeric;
  v_result jsonb;
  v_old_moq integer;
  v_old_price numeric;
BEGIN
  IF p_moq_quantity IS NULL OR p_moq_quantity <= 0 THEN
    RAISE EXCEPTION 'MOQ должен быть целым числом больше нуля';
  END IF;
  IF p_unit_price_cny IS NULL OR p_unit_price_cny <= 0 THEN
    RAISE EXCEPTION 'Цена должна быть больше нуля';
  END IF;
  IF p_cartons IS NULL OR p_cartons < 0 OR p_cartons > 100000 THEN
    RAISE EXCEPTION 'Количество коробов должно быть от 0 до 100 000';
  END IF;
  IF p_confirm IS NULL THEN
    RAISE EXCEPTION 'Не указан режим подтверждения';
  END IF;
  IF p_confirm AND (p_actor_user_id IS NULL OR nullif(btrim(p_actor_name),'') IS NULL) THEN
    RAISE EXCEPTION 'Не указан сотрудник, подтверждающий условия';
  END IF;
  
  SELECT * INTO v_item FROM public.ved_order_items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Позиция заказа не найдена'; END IF;
  IF v_item.added_manually IS DISTINCT FROM true OR v_item.selected_demand_units IS NOT NULL THEN
    RAISE EXCEPTION 'Для рассчитанного закупкой товара используется обычный расчёт';
  END IF;

  SELECT * INTO v_order FROM public.ved_orders WHERE id=v_item.ved_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заказ не найден'; END IF;
  IF v_order.workflow_status NOT IN ('draft','returned_for_edit') THEN
    RAISE EXCEPTION 'Подтверждение вручную добавленного товара возможно только в черновике';
  END IF;
  IF v_item.units_per_carton_snapshot IS NULL OR v_item.units_per_carton_snapshot<=0 THEN
    RAISE EXCEPTION 'Сначала укажите количество штук в транспортном коробе';
  END IF;

  v_quantity := p_cartons::numeric * v_item.units_per_carton_snapshot::numeric;
  IF v_quantity > 100000000 THEN
    RAISE EXCEPTION 'Количество товара к заказу превышает 100 млн шт.';
  END IF;
  IF p_cartons>0 AND v_quantity < p_moq_quantity THEN
    RAISE EXCEPTION 'Выбрано % шт., это меньше MOQ % шт. Увеличьте количество коробов или оставьте 0 для подтверждения только MOQ и цены',
      v_quantity::bigint, p_moq_quantity;
  END IF;

  v_result := jsonb_build_object(
    'ok',true,
    'item_id',v_item.id,
    'product_id',v_item.product_id,
    'our_article',v_item.our_article_snapshot,
    'chinese_article',v_item.chinese_article_snapshot,
    'product_name',v_item.product_name_snapshot,
    'scenario',v_order.calculation_scenario,
    'manual_order',true,
    'target_days',NULL,
    'target_coverage_days',NULL,
    'selected_demand_units',NULL,
    'units_per_carton',v_item.units_per_carton_snapshot,
    'moq_quantity',p_moq_quantity,
    'unit_price_cny',p_unit_price_cny,
    'standard_cartons',p_cartons,
    'standard_quantity',v_quantity::integer,
    'moq_changed_quantity',false,
    'final_cartons',p_cartons,
    'final_quantity',v_quantity::integer,
    'coverage_after_order_days',NULL,
    'moq_review_required',false,
    'moq_review_status','not_required',
    'total_price_cny',round(v_quantity*p_unit_price_cny,2),
    'total_volume_m3',CASE WHEN v_item.carton_volume_m3_snapshot IS NOT NULL
      THEN round(p_cartons*v_item.carton_volume_m3_snapshot,6) ELSE NULL END,
    'total_weight_tons',CASE WHEN v_item.carton_weight_kg_snapshot IS NOT NULL
      THEN round(p_cartons*v_item.carton_weight_kg_snapshot/1000,6) ELSE NULL END,
    'terms_confirmed',p_confirm,
    'proposed_cartons',p_cartons,
    'proposed_quantity',v_quantity::integer,
    'accepted_cartons',p_cartons,
    'accepted_quantity',v_quantity::integer,
    'ready_for_transport',(p_cartons>0 AND v_item.incoterm IS NOT NULL)
  );
  IF NOT p_confirm THEN RETURN v_result; END IF;

  v_old_moq := v_item.moq_quantity;
  v_old_price := v_item.unit_price_cny;

  UPDATE public.ved_order_items
  SET moq_quantity=p_moq_quantity,
      unit_price_cny=p_unit_price_cny,
      moq_confirmed_at=now(),
      price_confirmed_at=now(),
      moq_confirmed_by_user_id=p_actor_user_id,
      price_confirmed_by_user_id=p_actor_user_id,
      cartons=CASE WHEN p_cartons=0 THEN NULL ELSE p_cartons END,
      order_quantity=v_quantity::integer,
      manual_cartons_override=(p_cartons>0),
      coverage_after_order_days=NULL,
      moq_excess_review_required=false,
      moq_review_status='not_required',
      updated_at=now()
  WHERE id=p_item_id;

  IF v_item.product_id IS NOT NULL THEN
    UPDATE public.products
    SET last_moq=p_moq_quantity,
        last_unit_price_cny=p_unit_price_cny,
        last_commercial_terms_confirmed_at=now(),
        updated_at=now()
    WHERE id=v_item.product_id;
  END IF;

  INSERT INTO public.ved_order_audit_log(
    ved_order_id,ved_order_item_id,event_type,
    old_value,new_value,actor_user_id,actor_name,actor_role,metadata
  ) VALUES (
    v_item.ved_order_id,p_item_id,'commercial_terms_confirmed',
    jsonb_build_object('moq_quantity',v_old_moq,'unit_price_cny',v_old_price,
      'cartons',v_item.cartons,'order_quantity',v_item.order_quantity),
    jsonb_build_object('moq_quantity',p_moq_quantity,'unit_price_cny',p_unit_price_cny,
      'cartons',p_cartons,'order_quantity',v_quantity::integer),
    p_actor_user_id,btrim(p_actor_name),p_actor_role,
    jsonb_build_object('source','manual_order_terms','no_auto_moq_order',true)
  );

  RETURN v_result;
END
$manual$;

REVOKE ALL ON FUNCTION public.ved_manual_item_terms(uuid,integer,numeric,integer,boolean,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_manual_item_terms(uuid,integer,numeric,integer,boolean,uuid,text,text)
  TO service_role;
