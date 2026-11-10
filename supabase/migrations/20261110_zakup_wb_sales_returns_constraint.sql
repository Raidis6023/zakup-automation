-- China procurement uses FBW-only WB operations (sales S and returns R).
-- Keep the warehouse restriction; do not admit seller-warehouse/FBS rows.
-- Existing v9 already sums S and subtracts R separately.
DO $$
DECLARE
  original_rule text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO original_rule
  FROM pg_constraint c
  WHERE c.conrelid = 'public.wb_sales'::regclass
    AND c.conname = 'wb_sales_sale_id_check';
  IF original_rule IS NULL THEN
    RAISE EXCEPTION 'Expected wb_sales_sale_id_check is absent; migration stopped';
  END IF;
  IF original_rule NOT LIKE '%sale_id%' OR original_rule NOT LIKE '%S%%' THEN
    RAISE EXCEPTION 'Unexpected wb_sales_sale_id_check: %', original_rule;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.wb_sales'::regclass
      AND c.conname = 'wb_sales_fbw_only_check'
  ) THEN
    RAISE EXCEPTION 'FBW-only protection is missing; migration stopped';
  END IF;
END
$$;

ALTER TABLE public.wb_sales
  DROP CONSTRAINT wb_sales_sale_id_check;

ALTER TABLE public.wb_sales
  ADD CONSTRAINT wb_sales_sale_id_check
  CHECK (sale_id LIKE 'S%' OR sale_id LIKE 'R%');

COMMENT ON CONSTRAINT wb_sales_sale_id_check ON public.wb_sales
  IS 'WB operational sales S and returns R; FBW only (enforced by wb_sales_fbw_only_check).';
