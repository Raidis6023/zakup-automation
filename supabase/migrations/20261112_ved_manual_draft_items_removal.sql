-- Mark manually inserted lines, so only those can be removed from a draft.
ALTER TABLE public.ved_order_items ADD COLUMN IF NOT EXISTS added_manually boolean NOT NULL DEFAULT false;

DO $patch$
DECLARE original text; patched text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO original FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='ved_add_draft_items';
 IF original IS NULL THEN RAISE EXCEPTION 'ved_add_draft_items missing'; END IF;
 patched:=replace(original,
 'cartons,order_quantity,manual_cartons_override
    ) VALUES (',
 'cartons,order_quantity,manual_cartons_override,added_manually
    ) VALUES (');
 IF patched=original THEN RAISE EXCEPTION 'Manual insertion column list moved'; END IF;
 original:=patched;
 patched:=replace(original,
 'CASE WHEN v_cartons>0 THEN v_cartons ELSE NULL END,v_quantity,v_cartons>0
    ) RETURNING id',
 'CASE WHEN v_cartons>0 THEN v_cartons ELSE NULL END,v_quantity,v_cartons>0,true
    ) RETURNING id');
 IF patched=original THEN RAISE EXCEPTION 'Manual insertion values moved'; END IF;
 EXECUTE patched;
END
$patch$;

CREATE OR REPLACE FUNCTION public.ved_remove_manual_draft_item(
 p_order_id uuid,p_item_id uuid,p_actor_id uuid,p_actor_name text,p_actor_role text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $remove$
DECLARE v_order public.ved_orders%rowtype;
        v_item public.ved_order_items%rowtype;
BEGIN
 IF p_order_id IS NULL OR p_item_id IS NULL OR p_actor_id IS NULL
    OR nullif(btrim(p_actor_name),'') IS NULL THEN
   RAISE EXCEPTION 'Не указаны заказ, позиция или сотрудник';
 END IF;
 SELECT * INTO v_order FROM public.ved_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Заказ не найден'; END IF;
 IF v_order.workflow_status NOT IN ('draft','returned_for_edit') THEN
   RAISE EXCEPTION 'Удалять товары можно только в черновике';
 END IF;
 SELECT * INTO v_item FROM public.ved_order_items
 WHERE id=p_item_id AND ved_order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Позиция не найдена'; END IF;
 IF v_item.added_manually IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Удалить можно только товар, добавленный вручную';
 END IF;
 DELETE FROM public.ved_order_items WHERE id=p_item_id;
 INSERT INTO public.ved_order_audit_log(
   ved_order_id,event_type,field_name,old_value,
   actor_user_id,actor_name,actor_role,metadata
 ) VALUES (
   p_order_id,'item_removed','composition',
   jsonb_build_object('item_id',p_item_id,'product_id',v_item.product_id,
     'name',v_item.product_name_snapshot,'order_quantity',v_item.order_quantity),
   p_actor_id,p_actor_name,p_actor_role,
   jsonb_build_object('source','draft_composition_modal')
 );
 UPDATE public.ved_orders SET updated_at=now() WHERE id=p_order_id;
 RETURN jsonb_build_object('ok',true,'removed_id',p_item_id);
END
$remove$;

REVOKE ALL ON FUNCTION public.ved_remove_manual_draft_item(uuid,uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ved_remove_manual_draft_item(uuid,uuid,uuid,text,text)
 TO service_role;
