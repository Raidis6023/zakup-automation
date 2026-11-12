-- Any legacy editor updating a confirmed field must invalidate the affected
-- approval. A new block confirmation explicitly updates its own timestamp.
CREATE OR REPLACE FUNCTION public.ved_invalidate_changed_preparation_blocks()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $trigger$
DECLARE
  v_characteristics_changed boolean;
  v_packing_changed boolean;
  v_terms_changed boolean;
BEGIN
  v_packing_changed :=
    NEW.units_per_carton_snapshot IS DISTINCT FROM OLD.units_per_carton_snapshot OR
    NEW.carton_volume_m3_snapshot IS DISTINCT FROM OLD.carton_volume_m3_snapshot OR
    NEW.carton_weight_kg_snapshot IS DISTINCT FROM OLD.carton_weight_kg_snapshot;

  v_characteristics_changed :=
    NEW.product_name_snapshot IS DISTINCT FROM OLD.product_name_snapshot OR
    NEW.chinese_article_snapshot IS DISTINCT FROM OLD.chinese_article_snapshot OR
    NEW.photo_url IS DISTINCT FROM OLD.photo_url OR
    v_packing_changed OR
    NEW.import_carton_length_cm IS DISTINCT FROM OLD.import_carton_length_cm OR
    NEW.import_carton_width_cm IS DISTINCT FROM OLD.import_carton_width_cm OR
    NEW.import_carton_height_cm IS DISTINCT FROM OLD.import_carton_height_cm OR
    NEW.import_individual_length_cm IS DISTINCT FROM OLD.import_individual_length_cm OR
    NEW.import_individual_width_cm IS DISTINCT FROM OLD.import_individual_width_cm OR
    NEW.import_individual_height_cm IS DISTINCT FROM OLD.import_individual_height_cm OR
    NEW.import_hs_code IS DISTINCT FROM OLD.import_hs_code;

  v_terms_changed :=
    v_packing_changed OR
    NEW.moq_quantity IS DISTINCT FROM OLD.moq_quantity OR
    NEW.unit_price_cny IS DISTINCT FROM OLD.unit_price_cny OR
    NEW.cartons IS DISTINCT FROM OLD.cartons OR
    NEW.order_quantity IS DISTINCT FROM OLD.order_quantity;

  IF v_characteristics_changed AND
    NEW.characteristics_confirmed_at IS NOT DISTINCT FROM OLD.characteristics_confirmed_at THEN
    NEW.characteristics_confirmed_at:=NULL;
    NEW.characteristics_confirmed_by_user_id:=NULL;
  END IF;
  IF v_terms_changed AND
    NEW.order_terms_confirmed_at IS NOT DISTINCT FROM OLD.order_terms_confirmed_at THEN
    NEW.order_terms_confirmed_at:=NULL;
    NEW.order_terms_confirmed_by_user_id:=NULL;
  END IF;
  RETURN NEW;
END
$trigger$;

DROP TRIGGER IF EXISTS ved_preparation_confirmations_invalidate ON public.ved_order_items;
CREATE TRIGGER ved_preparation_confirmations_invalidate
BEFORE UPDATE ON public.ved_order_items
FOR EACH ROW EXECUTE FUNCTION public.ved_invalidate_changed_preparation_blocks();